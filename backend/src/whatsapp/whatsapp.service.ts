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

		// qrcode pode vir como objeto { base64: "...", code: "..." } ou string
		const rawQr = data?.qrcode;
		const qrcode = typeof rawQr === "object" && rawQr !== null
			? rawQr.base64 || rawQr.code || null
			: rawQr || null;

		return {
			id: insertId,
			instanceName,
			instanceKey,
			qrcode,
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
		const rawQr = data?.base64 || data?.qrcode;
		const qrcode = typeof rawQr === "object" && rawQr !== null
			? rawQr.base64 || rawQr.code || null
			: rawQr || null;

		return {
			qrcode,
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

	// Enviar media (imagem, video, audio, documento)
	async sendMedia(instanceName: string, number: string, mediaBase64: string, caption: string, mediatype: string = "image") {
		// Audio uses sendWhatsAppAudio endpoint for proper voice note format
		if (mediatype === "audio") {
			return this.sendAudio(instanceName, number, mediaBase64);
		}

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
					mediatype,
					media: mediaBase64,
					caption,
				}),
			},
		);

		if (!res.ok) throw new Error("Falha ao enviar media");
		return await res.json();
	}

	// Enviar audio como voice note (PTT)
	async sendAudio(instanceName: string, number: string, audioBase64: string) {
		const res = await fetch(
			`${this.evolutionUrl}/message/sendWhatsAppAudio/${instanceName}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					apikey: this.evolutionKey,
				},
				body: JSON.stringify({
					number,
					audio: audioBase64,
				}),
			},
		);

		if (!res.ok) throw new Error("Falha ao enviar audio");
		return await res.json();
	}

	// Buscar grupos da instancia via Evolution API
	async getGroups(instanceName: string) {
		const res = await fetch(
			`${this.evolutionUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`,
			{
				method: "GET",
				headers: { apikey: this.evolutionKey },
			},
		);

		if (!res.ok) {
			const err = await res.text();
			this.logger.error(`Evolution groups error: ${err}`);
			throw new Error("Falha ao buscar grupos");
		}

		const data = await res.json();
		// Evolution retorna array de grupos com id, subject, size, etc
		return (Array.isArray(data) ? data : data?.data || data || []).map((g: any) => ({
			id: g.id || g.jid,
			name: g.subject || g.name || g.id,
			size: g.size || g.participants?.length || 0,
		}));
	}

	// Buscar foto de perfil via Evolution API
	// number must be full JID: 5511999999999@s.whatsapp.net or groupid@g.us
	async getProfilePicture(instanceName: string, number: string): Promise<string | null> {
		try {
			this.logger.log(`Fetching profile pic: instance=${instanceName}, number=${number}`);
			const res = await fetch(
				`${this.evolutionUrl}/chat/fetchProfilePictureUrl/${instanceName}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						apikey: this.evolutionKey,
					},
					body: JSON.stringify({ number }),
				},
			);

			if (!res.ok) {
				const errText = await res.text().catch(() => "");
				this.logger.warn(`Profile pic fetch failed (${res.status}): ${errText}`);
				return null;
			}
			const data = await res.json();
			this.logger.log(`Profile pic response: ${JSON.stringify(data)}`);
			return data?.profilePictureUrl || null;
		} catch (err) {
			this.logger.error(`Profile pic error: ${err.message}`);
			return null;
		}
	}

	// Auto-configurar webhook do CRM ao conectar instancia
	async autoConfigureCrmWebhook(instanceName: string) {
		const pool = this.db.getPool();

		// Check if webhook already set for this instance
		const [rows] = await pool.query(
			`SELECT webhook_url FROM whatsapp_instances WHERE instance_name = ? OR instance_key = ? LIMIT 1`,
			[instanceName, instanceName],
		);
		const instance = (rows as any[])[0];
		const baseUrl = process.env.API_BASE_URL || process.env.WEBHOOK_BASE_URL || "";

		if (!baseUrl) {
			this.logger.warn("API_BASE_URL not set, skipping auto CRM webhook");
			return;
		}

		const crmWebhookUrl = `${baseUrl}/api/crm/webhook`;

		// Only set if not already configured with our CRM webhook
		if (instance?.webhook_url === crmWebhookUrl) return;

		try {
			await this.setWebhook(instanceName, crmWebhookUrl);
			await pool.query(
				`UPDATE whatsapp_instances SET webhook_url = ? WHERE instance_name = ? OR instance_key = ?`,
				[crmWebhookUrl, instanceName, instanceName],
			);
			this.logger.log(`CRM webhook auto-configured for ${instanceName}: ${crmWebhookUrl}`);
		} catch (err) {
			this.logger.error(`Failed to auto-configure CRM webhook for ${instanceName}: ${err.message}`);
		}
	}

	// Listar instancias do usuario
	async listByUser(userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT id, instance_name, display_name, COALESCE(display_name, instance_name) as instance_display,
			        instance_key, status, phone, webhook_url, created_at
			 FROM whatsapp_instances WHERE user_id = ? ORDER BY created_at DESC`,
			[userId],
		);
		return rows;
	}

	// Renomear instancia (apenas display name, instance_name fica como o nome real na Evolution)
	async renameInstance(instanceId: number, newName: string) {
		const pool = this.db.getPool();
		await pool.query(
			`UPDATE whatsapp_instances SET display_name = ? WHERE id = ?`,
			[newName, instanceId],
		);
		this.logger.log(`Instance ${instanceId} display_name set to: ${newName}`);
		return { ok: true, name: newName };
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
