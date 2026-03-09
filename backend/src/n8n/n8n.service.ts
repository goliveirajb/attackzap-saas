import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "~/database/database.service";

@Injectable()
export class N8nService {
	private readonly logger = new Logger(N8nService.name);
	private readonly n8nUrl = process.env.N8N_API_URL || "";
	private readonly n8nKey = process.env.N8N_API_KEY || "";
	private readonly evolutionUrl = process.env.EVOLUTION_API_URL || "";
	private readonly evolutionKey = process.env.EVOLUTION_API_KEY || "";

	constructor(private readonly db: DatabaseService) {}

	// Buscar credentials do N8N por tipo
	private async getN8nCredentials(typeName: string): Promise<{ id: string; name: string } | null> {
		try {
			const res = await fetch(`${this.n8nUrl}/api/v1/credentials`, {
				headers: { "X-N8N-API-KEY": this.n8nKey },
			});
			if (!res.ok) return null;
			const data = await res.json();
			const creds = (data.data || data || []) as any[];
			const found = creds.find((c: any) => c.type === typeName);
			return found ? { id: found.id, name: found.name } : null;
		} catch {
			return null;
		}
	}

	// Template: Mensagem Programada
	private buildMensagemProgramadaWorkflow(
		webhookPath: string,
		instanceName: string,
		evolutionCredId: string,
		evolutionCredName: string,
		headerAuthCredId: string,
		headerAuthCredName: string,
	) {
		return {
			name: `Mensagem-Programada - ${instanceName}`,
			nodes: [
				{
					parameters: {
						httpMethod: "POST",
						path: webhookPath,
						authentication: "headerAuth",
						responseMode: "responseNode",
						options: {},
					},
					type: "n8n-nodes-base.webhook",
					typeVersion: 2,
					position: [-1392, 704],
					id: `webhook-${Date.now()}`,
					name: "Webhook",
					webhookId: webhookPath,
					credentials: {
						httpHeaderAuth: {
							id: headerAuthCredId,
							name: headerAuthCredName,
						},
					},
				},
				{
					parameters: {
						assignments: {
							assignments: [
								{
									id: "f1",
									name: "number",
									value: "={{ $json.body.number || '' }}",
									type: "string",
								},
								{
									id: "f2",
									name: "text",
									value: "={{ $json.body.text || '' }}",
									type: "string",
								},
								{
									id: "f3",
									name: "caption",
									value: "={{ $json.body.caption || '' }}",
									type: "string",
								},
								{
									id: "f4",
									name: "media",
									value: "={{ $json.body.media || '' }}",
									type: "string",
								},
							],
						},
						options: {},
					},
					type: "n8n-nodes-base.set",
					typeVersion: 3.4,
					position: [-1136, 704],
					id: `editfields-${Date.now()}`,
					name: "Edit Fields1",
				},
				{
					parameters: {
						conditions: {
							options: {
								caseSensitive: true,
								leftValue: "",
								typeValidation: "loose",
								version: 2,
							},
							conditions: [
								{
									id: "cond1",
									leftValue: "={{ ($json.media || '').trim() }}",
									rightValue: "",
									operator: {
										type: "string",
										operation: "notEmpty",
										singleValue: true,
									},
								},
							],
							combinator: "and",
						},
						looseTypeValidation: true,
						options: {},
					},
					type: "n8n-nodes-base.if",
					typeVersion: 2.2,
					position: [-928, 704],
					id: `if-${Date.now()}`,
					name: "If1",
				},
				{
					parameters: {
						resource: "messages-api",
						operation: "send-image",
						instanceName,
						remoteJid: "={{$json['number']}}",
						media: "={{ ($json.media || '').replace(/^data:[^,]+,/, '').replace(/\\\\s/g, '') }}",
						caption: "={{$json.caption}}",
						options_message: {},
					},
					type: "n8n-nodes-evolution-api.evolutionApi",
					typeVersion: 1,
					position: [-464, 640],
					id: `sendimage-${Date.now()}`,
					name: "Enviar imagem1",
					credentials: {
						evolutionApi: {
							id: evolutionCredId,
							name: evolutionCredName,
						},
					},
				},
				{
					parameters: {
						resource: "messages-api",
						instanceName: `=${instanceName}`,
						remoteJid: "={{$json['number']}}",
						messageText: "={{$json['text']}}",
						options_message: {},
					},
					type: "n8n-nodes-evolution-api.evolutionApi",
					typeVersion: 1,
					position: [-480, 816],
					id: `sendtext-${Date.now()}`,
					name: "Enviar texto",
					credentials: {
						evolutionApi: {
							id: evolutionCredId,
							name: evolutionCredName,
						},
					},
				},
				{
					parameters: {
						respondWith: "json",
						responseBody: '{"message":"sucesso"}',
						options: {},
					},
					type: "n8n-nodes-base.respondToWebhook",
					typeVersion: 1.4,
					position: [-192, 704],
					id: `respond-${Date.now()}`,
					name: "Respond to Webhook1",
				},
			],
			connections: {
				Webhook: {
					main: [[{ node: "Edit Fields1", type: "main", index: 0 }]],
				},
				"Edit Fields1": {
					main: [[{ node: "If1", type: "main", index: 0 }]],
				},
				If1: {
					main: [
						[{ node: "Enviar imagem1", type: "main", index: 0 }],
						[{ node: "Enviar texto", type: "main", index: 0 }],
					],
				},
				"Enviar imagem1": {
					main: [[{ node: "Respond to Webhook1", type: "main", index: 0 }]],
				},
				"Enviar texto": {
					main: [[{ node: "Respond to Webhook1", type: "main", index: 0 }]],
				},
			},
			active: true,
			settings: { executionOrder: "v1" },
		};
	}

	// Criar workflow no N8N automaticamente
	async createWorkflow(userId: number, instanceId: number, instanceName: string, automationName: string) {
		const pool = this.db.getPool();

		// Buscar credentials do N8N
		const evolutionCred = await this.getN8nCredentials("evolutionApi");
		const headerAuthCred = await this.getN8nCredentials("httpHeaderAuth");

		if (!evolutionCred) {
			throw new Error("Credencial Evolution API não encontrada no N8N. Configure em: N8N > Credentials > Evolution API");
		}
		if (!headerAuthCred) {
			throw new Error("Credencial Header Auth não encontrada no N8N. Configure em: N8N > Credentials > Header Auth");
		}

		// Gerar path unico para o webhook
		const webhookPath = `msg-prog-${instanceName}-${Date.now()}`;

		// Montar workflow
		const workflow = this.buildMensagemProgramadaWorkflow(
			webhookPath,
			instanceName,
			evolutionCred.id,
			evolutionCred.name,
			headerAuthCred.id,
			headerAuthCred.name,
		);

		// Criar no N8N via API
		const res = await fetch(`${this.n8nUrl}/api/v1/workflows`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-N8N-API-KEY": this.n8nKey,
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
			 VALUES (?, ?, ?, 'scheduled_message', ?, ?, ?, 1)`,
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

		this.logger.log(`Workflow Mensagem Programada criado: ${workflowId} | Webhook: ${webhookUrl}`);

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
