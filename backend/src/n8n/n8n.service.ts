import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "~/database/database.service";

// Template base do workflow N8N para autoresposta WhatsApp
const WORKFLOW_TEMPLATE = (webhookPath: string, instanceName: string, evolutionUrl: string, evolutionKey: string) => ({
	name: `AutoBot - ${instanceName}`,
	nodes: [
		{
			parameters: {
				httpMethod: "POST",
				path: webhookPath,
				responseMode: "onReceived",
				responseData: "allEntries",
			},
			id: "webhook-node",
			name: "Webhook Evolution",
			type: "n8n-nodes-base.webhook",
			typeVersion: 1.1,
			position: [250, 300],
			webhookId: webhookPath,
		},
		{
			parameters: {
				conditions: {
					string: [
						{
							value1: "={{ $json.body.data.messageType }}",
							operation: "equals",
							value2: "conversation",
						},
					],
				},
			},
			id: "filter-node",
			name: "Filtrar Mensagens",
			type: "n8n-nodes-base.if",
			typeVersion: 1,
			position: [470, 300],
		},
		{
			parameters: {
				method: "POST",
				url: `${evolutionUrl}/message/sendText/${instanceName}`,
				sendHeaders: true,
				headerParameters: {
					parameters: [
						{ name: "Content-Type", value: "application/json" },
						{ name: "apikey", value: evolutionKey },
					],
				},
				sendBody: true,
				bodyParameters: {
					parameters: [
						{
							name: "number",
							value: "={{ $json.body.data.key.remoteJid }}",
						},
						{
							name: "text",
							value: "Olá! Recebi sua mensagem. Em breve retornaremos.",
						},
					],
				},
			},
			id: "send-reply-node",
			name: "Responder WhatsApp",
			type: "n8n-nodes-base.httpRequest",
			typeVersion: 4.1,
			position: [700, 200],
		},
	],
	connections: {
		"Webhook Evolution": {
			main: [[{ node: "Filtrar Mensagens", type: "main", index: 0 }]],
		},
		"Filtrar Mensagens": {
			main: [
				[{ node: "Responder WhatsApp", type: "main", index: 0 }],
				[],
			],
		},
	},
	settings: { executionOrder: "v1" },
});

@Injectable()
export class N8nService {
	private readonly logger = new Logger(N8nService.name);
	private readonly n8nUrl = process.env.N8N_API_URL || "";
	private readonly n8nKey = process.env.N8N_API_KEY || "";
	private readonly evolutionUrl = process.env.EVOLUTION_API_URL || "";
	private readonly evolutionKey = process.env.EVOLUTION_API_KEY || "";

	constructor(private readonly db: DatabaseService) {}

	// Criar workflow no N8N automaticamente
	async createWorkflow(userId: number, instanceId: number, instanceName: string, automationName: string) {
		const pool = this.db.getPool();

		// Gerar path unico para o webhook
		const webhookPath = `autobot-${instanceName}-${Date.now()}`;

		// Montar workflow a partir do template
		const workflow = WORKFLOW_TEMPLATE(
			webhookPath,
			instanceName,
			this.evolutionUrl,
			this.evolutionKey,
		);

		// Criar no N8N via API
		const res = await fetch(`${this.n8nUrl}/api/v1/workflows`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-N8N-API-KEY": this.n8nKey,
				Authorization: `Bearer ${this.n8nKey}`,
			},
			body: JSON.stringify(workflow),
		});

		if (!res.ok) {
			const err = await res.text();
			this.logger.error(`N8N create workflow error: ${err}`);
			throw new Error(`Falha ao criar workflow no N8N: ${err}`);
		}

		const n8nData = await res.json();
		const workflowId = String(n8nData.id);

		// Ativar o workflow
		await fetch(`${this.n8nUrl}/api/v1/workflows/${workflowId}/activate`, {
			method: "POST",
			headers: { "X-N8N-API-KEY": this.n8nKey },
		});

		// Montar webhook URL do N8N
		const webhookUrl = `${this.n8nUrl}/webhook/${webhookPath}`;

		// Salvar automacao no banco
		const [result] = await pool.query(
			`INSERT INTO automations (user_id, instance_id, name, type, n8n_workflow_id, n8n_webhook_url, config, active)
			 VALUES (?, ?, ?, 'auto_reply', ?, ?, ?, 1)`,
			[
				userId,
				instanceId,
				automationName,
				workflowId,
				webhookUrl,
				JSON.stringify({ webhookPath, instanceName }),
			],
		);

		const automationId = (result as any).insertId;

		this.logger.log(`Workflow N8N criado: ${workflowId} | Webhook: ${webhookUrl}`);

		return {
			id: automationId,
			workflowId,
			webhookUrl,
			webhookPath,
		};
	}

	// Conectar webhook da Evolution ao N8N automaticamente
	async connectEvolutionWebhook(instanceName: string, webhookUrl: string) {
		const res = await fetch(
			`${this.evolutionUrl}/webhook/set/${instanceName}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					apikey: this.evolutionKey,
				},
				body: JSON.stringify({
					webhook: {
						enabled: true,
						url: webhookUrl,
						webhookByEvents: false,
						webhookBase64: true,
						events: [
							"MESSAGES_UPSERT",
							"CONNECTION_UPDATE",
						],
					},
				}),
			},
		);

		if (!res.ok) {
			throw new Error("Falha ao conectar webhook Evolution -> N8N");
		}

		// Atualiza webhook_url na instancia
		const pool = this.db.getPool();
		await pool.query(
			`UPDATE whatsapp_instances SET webhook_url = ? WHERE instance_name = ?`,
			[webhookUrl, instanceName],
		);

		return { connected: true, webhookUrl };
	}

	// Listar automacoes do usuario
	async listByUser(userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT a.*, wi.instance_name
			 FROM automations a
			 LEFT JOIN whatsapp_instances wi ON a.instance_id = wi.id
			 WHERE a.user_id = ?
			 ORDER BY a.created_at DESC`,
			[userId],
		);
		return rows;
	}

	// Deletar workflow do N8N e automacao
	async deleteAutomation(automationId: number) {
		const pool = this.db.getPool();

		const [rows] = await pool.query(
			`SELECT n8n_workflow_id FROM automations WHERE id = ?`,
			[automationId],
		);

		const automation = (rows as any[])[0];

		if (automation?.n8n_workflow_id) {
			await fetch(
				`${this.n8nUrl}/api/v1/workflows/${automation.n8n_workflow_id}`,
				{
					method: "DELETE",
					headers: { "X-N8N-API-KEY": this.n8nKey },
				},
			).catch(() => {});
		}

		await pool.query(`DELETE FROM automations WHERE id = ?`, [automationId]);

		return { deleted: true };
	}

	// Toggle ativar/desativar
	async toggleAutomation(automationId: number, active: boolean) {
		const pool = this.db.getPool();

		const [rows] = await pool.query(
			`SELECT n8n_workflow_id FROM automations WHERE id = ?`,
			[automationId],
		);

		const automation = (rows as any[])[0];

		if (automation?.n8n_workflow_id) {
			const endpoint = active ? "activate" : "deactivate";
			await fetch(
				`${this.n8nUrl}/api/v1/workflows/${automation.n8n_workflow_id}/${endpoint}`,
				{
					method: "POST",
					headers: { "X-N8N-API-KEY": this.n8nKey },
				},
			).catch(() => {});
		}

		await pool.query(
			`UPDATE automations SET active = ? WHERE id = ?`,
			[active ? 1 : 0, automationId],
		);

		return { active };
	}
}
