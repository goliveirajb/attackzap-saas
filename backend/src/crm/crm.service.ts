import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "~/database/database.service";
import { WhatsappService } from "~/whatsapp/whatsapp.service";

@Injectable()
export class CrmService implements OnModuleInit {
	private readonly logger = new Logger(CrmService.name);

	constructor(
		private readonly db: DatabaseService,
		private readonly whatsapp: WhatsappService,
	) {}

	async onModuleInit() {
		// Seed default stages for users who don't have any
		// (done on demand per user in getStages)
	}

	// ==================== STAGES ====================

	async getStages(userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT * FROM crm_stages WHERE user_id = ? ORDER BY position ASC`,
			[userId],
		);
		const stages = rows as any[];

		// Seed defaults if empty
		if (stages.length === 0) {
			const defaults = [
				{ name: "Novo Lead", color: "#6366f1", position: 0 },
				{ name: "Em Contato", color: "#0a6fbe", position: 1 },
				{ name: "Negociando", color: "#f59e0b", position: 2 },
				{ name: "Fechado", color: "#10b981", position: 3 },
				{ name: "Perdido", color: "#ef4444", position: 4 },
			];
			for (const s of defaults) {
				await pool.query(
					`INSERT INTO crm_stages (user_id, name, color, position) VALUES (?, ?, ?, ?)`,
					[userId, s.name, s.color, s.position],
				);
			}
			const [seeded] = await pool.query(
				`SELECT * FROM crm_stages WHERE user_id = ? ORDER BY position ASC`,
				[userId],
			);
			return seeded;
		}

		return stages;
	}

	async createStage(userId: number, name: string, color: string) {
		const pool = this.db.getPool();
		const [maxRow] = await pool.query(
			`SELECT COALESCE(MAX(position), -1) as maxPos FROM crm_stages WHERE user_id = ?`,
			[userId],
		);
		const position = ((maxRow as any[])[0]?.maxPos ?? -1) + 1;

		const [result] = await pool.query(
			`INSERT INTO crm_stages (user_id, name, color, position) VALUES (?, ?, ?, ?)`,
			[userId, name, color, position],
		);
		return { id: (result as any).insertId, name, color, position };
	}

	async updateStage(id: number, data: { name?: string; color?: string; position?: number }) {
		const pool = this.db.getPool();
		const fields: string[] = [];
		const values: any[] = [];

		if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
		if (data.color !== undefined) { fields.push("color = ?"); values.push(data.color); }
		if (data.position !== undefined) { fields.push("position = ?"); values.push(data.position); }

		if (fields.length === 0) return;
		values.push(id);
		await pool.query(`UPDATE crm_stages SET ${fields.join(", ")} WHERE id = ?`, values);
	}

	async deleteStage(id: number) {
		const pool = this.db.getPool();
		// Move contacts from this stage to null
		await pool.query(`UPDATE contacts SET stage_id = NULL WHERE stage_id = ?`, [id]);
		await pool.query(`DELETE FROM crm_stages WHERE id = ?`, [id]);
	}

	// ==================== CONTACTS ====================

	async getContacts(userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT c.*, cs.name as stage_name, cs.color as stage_color,
			        wi.instance_name
			 FROM contacts c
			 LEFT JOIN crm_stages cs ON c.stage_id = cs.id
			 LEFT JOIN whatsapp_instances wi ON c.instance_id = wi.id
			 WHERE c.user_id = ?
			 ORDER BY c.last_message_at DESC, c.updated_at DESC`,
			[userId],
		);
		return rows;
	}

	async getContact(userId: number, contactId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT c.*, cs.name as stage_name, cs.color as stage_color
			 FROM contacts c
			 LEFT JOIN crm_stages cs ON c.stage_id = cs.id
			 WHERE c.id = ? AND c.user_id = ?`,
			[contactId, userId],
		);
		return (rows as any[])[0] || null;
	}

	async createContact(userId: number, data: {
		name?: string; phone: string; email?: string;
		notes?: string; tags?: string; stage_id?: number; instance_id?: number;
	}) {
		const pool = this.db.getPool();

		// If no stage_id, use first stage
		let stageId = data.stage_id || null;
		if (!stageId) {
			const stages = await this.getStages(userId);
			if ((stages as any[]).length > 0) stageId = (stages as any[])[0].id;
		}

		const [result] = await pool.query(
			`INSERT INTO contacts (user_id, instance_id, name, phone, email, notes, tags, stage_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE
			   name = COALESCE(VALUES(name), name),
			   instance_id = COALESCE(VALUES(instance_id), instance_id),
			   updated_at = NOW()`,
			[userId, data.instance_id || null, data.name || null, data.phone, data.email || null, data.notes || null, data.tags || null, stageId],
		);
		return { id: (result as any).insertId || (result as any).affectedRows };
	}

	async updateContact(id: number, data: {
		name?: string; phone?: string; email?: string;
		notes?: string; tags?: string; stage_id?: number | null;
	}) {
		const pool = this.db.getPool();
		const fields: string[] = [];
		const values: any[] = [];

		if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
		if (data.phone !== undefined) { fields.push("phone = ?"); values.push(data.phone); }
		if (data.email !== undefined) { fields.push("email = ?"); values.push(data.email); }
		if (data.notes !== undefined) { fields.push("notes = ?"); values.push(data.notes); }
		if (data.tags !== undefined) { fields.push("tags = ?"); values.push(data.tags); }
		if (data.stage_id !== undefined) { fields.push("stage_id = ?"); values.push(data.stage_id); }

		if (fields.length === 0) return;
		values.push(id);
		await pool.query(`UPDATE contacts SET ${fields.join(", ")} WHERE id = ?`, values);
	}

	async moveContact(id: number, stageId: number | null) {
		const pool = this.db.getPool();
		await pool.query(`UPDATE contacts SET stage_id = ? WHERE id = ?`, [stageId, id]);
	}

	async deleteContact(id: number) {
		const pool = this.db.getPool();
		await pool.query(`DELETE FROM contacts WHERE id = ?`, [id]);
	}

	// ==================== MESSAGES ====================

	async getMessages(contactId: number, limit = 50) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT * FROM contact_messages WHERE contact_id = ? ORDER BY created_at DESC LIMIT ?`,
			[contactId, limit],
		);
		return (rows as any[]).reverse();
	}

	// ==================== SEND MESSAGE ====================

	async sendMessage(userId: number, contactId: number, text: string) {
		const pool = this.db.getPool();

		// Get contact with instance info
		const [rows] = await pool.query(
			`SELECT c.*, wi.instance_name
			 FROM contacts c
			 LEFT JOIN whatsapp_instances wi ON c.instance_id = wi.id
			 WHERE c.id = ? AND c.user_id = ?`,
			[contactId, userId],
		);
		const contact = (rows as any[])[0];
		if (!contact) throw new Error("Contato nao encontrado");
		if (!contact.instance_name) throw new Error("Contato sem instancia vinculada");

		// Send via Evolution
		await this.whatsapp.sendText(contact.instance_name, contact.phone, text);

		// Save to DB
		await pool.query(
			`INSERT INTO contact_messages (contact_id, user_id, direction, message_text, message_type, remote_jid, instance_name)
			 VALUES (?, ?, 'outgoing', ?, 'text', ?, ?)`,
			[contactId, userId, text, `${contact.phone}@s.whatsapp.net`, contact.instance_name],
		);

		// Update last_message_at
		await pool.query(`UPDATE contacts SET last_message_at = NOW() WHERE id = ?`, [contactId]);

		this.logger.log(`Message sent to ${contact.phone} via ${contact.instance_name}`);
		return { ok: true };
	}

	// ==================== WEBHOOK (Evolution) ====================

	async processIncomingMessage(payload: any) {
		const pool = this.db.getPool();

		const event = payload?.event;
		if (event !== "messages.upsert") return { ignored: true };

		const data = payload?.data;
		if (!data) return { ignored: true };

		const instanceName = payload?.instance;
		const remoteJid = data?.key?.remoteJid;
		const fromMe = data?.key?.fromMe;
		const messageText =
			data?.message?.conversation ||
			data?.message?.extendedTextMessage?.text ||
			data?.message?.imageMessage?.caption ||
			"";
		const messageType = data?.message?.imageMessage
			? "image"
			: data?.message?.videoMessage
			? "video"
			: data?.message?.audioMessage
			? "audio"
			: data?.message?.documentMessage
			? "document"
			: "text";

		// Skip group messages and status broadcasts
		if (!remoteJid || remoteJid.includes("@g.us") || remoteJid === "status@broadcast") {
			return { ignored: true };
		}

		// Extract phone number from jid (5511999999999@s.whatsapp.net -> 5511999999999)
		const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "");

		// Find instance + user
		const [instances] = await pool.query(
			`SELECT id, user_id FROM whatsapp_instances WHERE instance_name = ? LIMIT 1`,
			[instanceName],
		);
		const instance = (instances as any[])[0];
		if (!instance) return { ignored: true, reason: "instance not found" };

		const userId = instance.user_id;
		const instanceId = instance.id;

		// Get default stage
		const stages = await this.getStages(userId);
		const firstStage = (stages as any[])[0];

		// Upsert contact
		await pool.query(
			`INSERT INTO contacts (user_id, instance_id, phone, stage_id, last_message_at)
			 VALUES (?, ?, ?, ?, NOW())
			 ON DUPLICATE KEY UPDATE
			   instance_id = COALESCE(VALUES(instance_id), instance_id),
			   last_message_at = NOW(),
			   updated_at = NOW()`,
			[userId, instanceId, phone, firstStage?.id || null],
		);

		// Get contact ID
		const [contacts] = await pool.query(
			`SELECT id FROM contacts WHERE user_id = ? AND phone = ?`,
			[userId, phone],
		);
		const contact = (contacts as any[])[0];
		if (!contact) return { ignored: true };

		// Save message
		await pool.query(
			`INSERT INTO contact_messages (contact_id, user_id, direction, message_text, message_type, remote_jid, instance_name, raw_data)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				contact.id,
				userId,
				fromMe ? "outgoing" : "incoming",
				messageText,
				messageType,
				remoteJid,
				instanceName,
				JSON.stringify(data),
			],
		);

		this.logger.log(`Message saved: ${phone} (${fromMe ? "out" : "in"}) via ${instanceName}`);
		return { ok: true, contactId: contact.id, phone };
	}
}
