import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "~/database/database.service";

@Injectable()
export class WhatsappService {
	private readonly logger = new Logger(WhatsappService.name);
	private readonly evolutionUrl = process.env.EVOLUTION_API_URL || "";
	private readonly evolutionKey = process.env.EVOLUTION_API_KEY || "";

	constructor(private readonly db: DatabaseService) {}

	// Criar instancia na Evolution API
	async createInstance(userId: number, instanceName: string) {
		const pool = this.db.getPool();

		// Cria na Evolution API
		const res = await fetch(`${this.evolutionUrl}/instance/create`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: this.evolutionKey,
			},
			body: JSON.stringify({
				instanceName,
				integration: "WHATSAPP-BAILEYS",
				qrcode: true,
				rejectCall: false,
				groupsIgnore: false,
				alwaysOnline: false,
				readMessages: false,
				readStatus: false,
				syncFullHistory: false,
			}),
		});

		if (!res.ok) {
			const err = await res.text();
			this.logger.error(`Evolution create error: ${err}`);
			throw new Error(`Falha ao criar instancia: ${err}`);
		}

		const data = await res.json();
		const instanceKey = data?.hash || data?.instance?.instanceName || instanceName;

		// Salva no banco
		const [result] = await pool.query(
			`INSERT INTO whatsapp_instances (user_id, instance_name, instance_key, status)
			 VALUES (?, ?, ?, 'connecting')`,
			[userId, instanceName, instanceKey],
		);

		const insertId = (result as any).insertId;

		this.logger.log(`Instance created: ${instanceName} (ID ${insertId})`);

		return {
			id: insertId,
			instanceName,
			instanceKey,
			qrcode: data?.qrcode || null,
			status: "connecting",
		};
	}

	// Buscar QR Code da Evolution
	async getQrCode(instanceName: string) {
		const res = await fetch(
			`${this.evolutionUrl}/instance/connect/${instanceName}`,
			{
				method: "GET",
				headers: { apikey: this.evolutionKey },
			},
		);

		if (!res.ok) {
			throw new Error("Falha ao buscar QR Code");
		}

		const data = await res.json();
		return {
			qrcode: data?.base64 || data?.qrcode || null,
			status: data?.instance?.state || "connecting",
		};
	}

	// Verificar status da conexao
	async getConnectionStatus(instanceName: string) {
		const res = await fetch(
			`${this.evolutionUrl}/instance/connectionState/${instanceName}`,
			{
				method: "GET",
				headers: { apikey: this.evolutionKey },
			},
		);

		if (!res.ok) return { status: "disconnected" };

		const data = await res.json();
		const state = data?.instance?.state || "disconnected";

		return { status: state === "open" ? "connected" : state };
	}

	// Atualizar status no banco
	async updateInstanceStatus(instanceId: number, status: string, phone?: string) {
		const pool = this.db.getPool();
		const fields = ["status = ?"];
		const values: any[] = [status];

		if (phone) {
			fields.push("phone = ?");
			values.push(phone);
		}

		values.push(instanceId);
		await pool.query(
			`UPDATE whatsapp_instances SET ${fields.join(", ")} WHERE id = ?`,
			values,
		);
	}

	// Configurar webhook da Evolution para a instancia
	async setWebhook(instanceName: string, webhookUrl: string) {
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
							"MESSAGES_UPDATE",
							"CONNECTION_UPDATE",
							"QRCODE_UPDATED",
						],
					},
				}),
			},
		);

		if (!res.ok) {
			throw new Error("Falha ao configurar webhook");
		}

		return await res.json();
	}

	// Enviar mensagem de texto
	async sendText(instanceName: string, number: string, text: string) {
		const res = await fetch(
			`${this.evolutionUrl}/message/sendText/${instanceName}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					apikey: this.evolutionKey,
				},
				body: JSON.stringify({ number, text }),
			},
		);

		if (!res.ok) throw new Error("Falha ao enviar mensagem");
		return await res.json();
	}

	// Enviar media (imagem com caption)
	async sendMedia(instanceName: string, number: string, mediaBase64: string, caption: string) {
		const res = await fetch(
			`${this.evolutionUrl}/message/sendMedia/${instanceName}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					apikey: this.evolutionKey,
				},
				body: JSON.stringify({
					number,
					mediatype: "image",
					media: mediaBase64,
					caption,
				}),
			},
		);

		if (!res.ok) throw new Error("Falha ao enviar media");
		return await res.json();
	}

	// Listar instancias do usuario
	async listByUser(userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT id, instance_name, instance_key, status, phone, webhook_url, created_at
			 FROM whatsapp_instances WHERE user_id = ? ORDER BY created_at DESC`,
			[userId],
		);
		return rows;
	}

	// Deletar instancia
	async deleteInstance(instanceId: number, instanceName: string) {
		// Remove da Evolution
		await fetch(`${this.evolutionUrl}/instance/delete/${instanceName}`, {
			method: "DELETE",
			headers: { apikey: this.evolutionKey },
		}).catch(() => {});

		// Remove do banco
		const pool = this.db.getPool();
		await pool.query(`DELETE FROM whatsapp_instances WHERE id = ?`, [instanceId]);
	}
}
