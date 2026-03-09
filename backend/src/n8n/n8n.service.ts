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

	// Template: Mensagem Programada (usa httpRequest nativo, sem plugins)
	private buildMensagemProgramadaWorkflow(webhookPath: string, instanceName: string) {
		return {
			name: `Mensagem-Programada - ${instanceName}`,
			nodes: [
				{
					parameters: {
						httpMethod: "POST",
						path: webhookPath,
						responseMode: "responseNode",
						options: {},
					},
					type: "n8n-nodes-base.webhook",
					typeVersion: 2,
					position: [-1392, 704],
					id: `wh-${Date.now()}`,
					name: "Webhook",
					webhookId: webhookPath,
				},
				{
					parameters: {
						assignments: {
							assignments: [
								{ id: "f1", name: "number", value: "={{ ($json.body && $json.body.number) || $json.number || '' }}", type: "string" },
								{ id: "f2", name: "text", value: "={{ ($json.body && $json.body.text) || $json.text || '' }}", type: "string" },
								{ id: "f3", name: "caption", value: "={{ ($json.body && $json.body.caption) || $json.caption || '' }}", type: "string" },
								{ id: "f4", name: "media", value: "={{ ($json.body && $json.body.media) || $json.media || '' }}", type: "string" },
							],
						},
						options: {},
					},
					type: "n8n-nodes-base.set",
					typeVersion: 3.4,
					position: [-1136, 704],
					id: `ef-${Date.now()}`,
					name: "Edit Fields1",
				},
				{
					parameters: {
						conditions: {
							options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
							conditions: [{
								id: "c1",
								leftValue: "={{ ($json.media || '').trim() }}",
								rightValue: "",
								operator: { type: "string", operation: "notEmpty", singleValue: true },
							}],
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
						method: "POST",
						url: `${this.evolutionUrl}/message/sendMedia/${instanceName}`,
						sendHeaders: true,
						headerParameters: {
							parameters: [
								{ name: "Content-Type", value: "application/json" },
								{ name: "apikey", value: this.evolutionKey },
							],
						},
						sendBody: true,
						specifyBody: "json",
						jsonBody: `={{ JSON.stringify({ number: $json.number, mediatype: "image", media: ($json.media || "").replace(/^data:[^,]+,/, ""), caption: $json.caption || "", fileName: "image.jpg" }) }}`,
					},
					type: "n8n-nodes-base.httpRequest",
					typeVersion: 4.2,
					position: [-464, 640],
					id: `img-${Date.now()}`,
					name: "Enviar imagem",
				},
				{
					parameters: {
						method: "POST",
						url: `${this.evolutionUrl}/message/sendText/${instanceName}`,
						sendHeaders: true,
						headerParameters: {
							parameters: [
								{ name: "Content-Type", value: "application/json" },
								{ name: "apikey", value: this.evolutionKey },
							],
						},
						sendBody: true,
						specifyBody: "json",
						jsonBody: `={{ JSON.stringify({ number: $json.number, text: $json.text }) }}`,
					},
					type: "n8n-nodes-base.httpRequest",
					typeVersion: 4.2,
					position: [-480, 816],
					id: `txt-${Date.now()}`,
					name: "Enviar texto",
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
					id: `rsp-${Date.now()}`,
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
						[{ node: "Enviar imagem", type: "main", index: 0 }],
						[{ node: "Enviar texto", type: "main", index: 0 }],
					],
				},
				"Enviar imagem": {
					main: [[{ node: "Respond to Webhook1", type: "main", index: 0 }]],
				},
				"Enviar texto": {
					main: [[{ node: "Respond to Webhook1", type: "main", index: 0 }]],
				},
			},
			settings: { executionOrder: "v1" },
		};
	}

	// Template: Busca de Grupos WhatsApp
	private buildBuscaGruposWorkflow(webhookPath: string, instanceName: string) {
		return {
			name: `Busca-Grupos - ${instanceName}`,
			nodes: [
				{
					parameters: {
						httpMethod: "POST",
						path: webhookPath,
						responseMode: "responseNode",
						options: {},
					},
					type: "n8n-nodes-base.webhook",
					typeVersion: 2,
					position: [-1392, 704],
					id: `wh-${Date.now()}`,
					name: "Webhook",
					webhookId: webhookPath,
				},
				{
					parameters: {
						method: "GET",
						url: `${this.evolutionUrl}/group/fetchAllGroups/${instanceName}`,
						sendHeaders: true,
						headerParameters: {
							parameters: [
								{ name: "Content-Type", value: "application/json" },
								{ name: "apikey", value: this.evolutionKey },
							],
						},
						options: {},
					},
					type: "n8n-nodes-base.httpRequest",
					typeVersion: 4.2,
					position: [-1136, 704],
					id: `fetch-${Date.now()}`,
					name: "Buscar Grupos",
				},
				{
					parameters: {
						respondWith: "allIncomingItems",
						options: {},
					},
					type: "n8n-nodes-base.respondToWebhook",
					typeVersion: 1.4,
					position: [-880, 704],
					id: `rsp-${Date.now()}`,
					name: "Retornar Grupos",
				},
			],
			connections: {
				Webhook: {
					main: [[{ node: "Buscar Grupos", type: "main", index: 0 }]],
				},
				"Buscar Grupos": {
					main: [[{ node: "Retornar Grupos", type: "main", index: 0 }]],
				},
			},
			settings: { executionOrder: "v1" },
		};
	}

	// Criar workflow no N8N automaticamente
	async createWorkflow(
		userId: number,
		instanceId: number,
		instanceName: string,
		automationName: string,
		type: "scheduled_message" | "group_fetch" = "scheduled_message",
	) {
		const pool = this.db.getPool();

		const prefix = type === "group_fetch" ? "busca-grupos" : "msg-prog";
		const webhookPath = `${prefix}-${instanceName}-${Date.now()}`;

		const workflow = type === "group_fetch"
			? this.buildBuscaGruposWorkflow(webhookPath, instanceName)
			: this.buildMensagemProgramadaWorkflow(webhookPath, instanceName);

		this.logger.log(`Criando workflow N8N [${type}] para ${instanceName}...`);

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

		const webhookUrl = `${this.n8nUrl}/webhook/${webhookPath}`;

		const [result] = await pool.query(
			`INSERT INTO automations (user_id, instance_id, name, type, n8n_workflow_id, n8n_webhook_url, config, active)
			 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
			[userId, instanceId, automationName, type, workflowId, webhookUrl, JSON.stringify({ webhookPath, instanceName })],
		);

		const automationId = (result as any).insertId;
		this.logger.log(`Workflow criado [${type}]: ${workflowId} | Webhook: ${webhookUrl}`);

		return { id: automationId, workflowId, webhookUrl, webhookPath, type };
	}

	// Conectar webhook da Evolution ao N8N
	async connectEvolutionWebhook(instanceName: string, webhookUrl: string) {
		const res = await fetch(`${this.evolutionUrl}/webhook/set/${instanceName}`, {
			method: "POST",
			headers: { "Content-Type": "application/json", apikey: this.evolutionKey },
			body: JSON.stringify({
				webhook: {
					enabled: true,
					url: webhookUrl,
					webhookByEvents: false,
					webhookBase64: true,
					events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
				},
			}),
		});

		if (!res.ok) throw new Error("Falha ao conectar webhook Evolution -> N8N");

		const pool = this.db.getPool();
		await pool.query(`UPDATE whatsapp_instances SET webhook_url = ? WHERE instance_name = ?`, [webhookUrl, instanceName]);
		return { connected: true, webhookUrl };
	}

	async listByUser(userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT a.*, wi.instance_name FROM automations a LEFT JOIN whatsapp_instances wi ON a.instance_id = wi.id WHERE a.user_id = ? ORDER BY a.created_at DESC`,
			[userId],
		);
		return rows;
	}

	async deleteAutomation(automationId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(`SELECT n8n_workflow_id FROM automations WHERE id = ?`, [automationId]);
		const automation = (rows as any[])[0];
		if (automation?.n8n_workflow_id) {
			await fetch(`${this.n8nUrl}/api/v1/workflows/${automation.n8n_workflow_id}`, {
				method: "DELETE",
				headers: { "X-N8N-API-KEY": this.n8nKey },
			}).catch(() => {});
		}
		await pool.query(`DELETE FROM automations WHERE id = ?`, [automationId]);
		return { deleted: true };
	}

	async toggleAutomation(automationId: number, active: boolean) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(`SELECT n8n_workflow_id FROM automations WHERE id = ?`, [automationId]);
		const automation = (rows as any[])[0];
		if (automation?.n8n_workflow_id) {
			const endpoint = active ? "activate" : "deactivate";
			await fetch(`${this.n8nUrl}/api/v1/workflows/${automation.n8n_workflow_id}/${endpoint}`, {
				method: "POST",
				headers: { "X-N8N-API-KEY": this.n8nKey },
			}).catch(() => {});
		}
		await pool.query(`UPDATE automations SET active = ? WHERE id = ?`, [active ? 1 : 0, automationId]);
		return { active };
	}
}
