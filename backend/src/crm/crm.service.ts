import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { DatabaseService } from "~/database/database.service";
import { WhatsappService } from "~/whatsapp/whatsapp.service";
import { CrmEventsService } from "./crm-events.service";
import { PushService } from "~/push/push.service";

@Injectable()
export class CrmService implements OnModuleInit {
	private readonly logger = new Logger(CrmService.name);
	private aiService: any; // Lazy-loaded to avoid circular dependency

	constructor(
		private readonly db: DatabaseService,
		private readonly whatsapp: WhatsappService,
		private readonly events: CrmEventsService,
		private readonly push: PushService,
		private readonly moduleRef: ModuleRef,
	) {}

	async onModuleInit() {
		// Lazy-load AiService to avoid circular dependency
		const { AiService } = await import("./ai.service");
		this.aiService = this.moduleRef.get(AiService, { strict: false });
	}

	// ==================== DASHBOARD STATS ====================

	async getDashboardStats(userId: number) {
		const pool = this.db.getPool();

		// Total contacts
		const [[{ total_contacts }]] = await pool.query(
			`SELECT COUNT(*) as total_contacts FROM contacts WHERE user_id = ?`, [userId],
		) as any;

		// Total messages
		const [[{ total_messages }]] = await pool.query(
			`SELECT COUNT(*) as total_messages FROM contact_messages WHERE user_id = ?`, [userId],
		) as any;

		// Messages incoming vs outgoing
		const [directionRows] = await pool.query(
			`SELECT direction, COUNT(*) as count FROM contact_messages WHERE user_id = ? GROUP BY direction`, [userId],
		) as any;
		const incoming = directionRows.find((r: any) => r.direction === "incoming")?.count || 0;
		const outgoing = directionRows.find((r: any) => r.direction === "outgoing")?.count || 0;

		// Messages per day (last 14 days)
		const [messagesPerDay] = await pool.query(
			`SELECT DATE(created_at) as date, direction, COUNT(*) as count
			 FROM contact_messages WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
			 GROUP BY DATE(created_at), direction ORDER BY date ASC`, [userId],
		) as any;

		// Contacts per stage
		const [contactsPerStage] = await pool.query(
			`SELECT COALESCE(s.name, 'Sem etapa') as stage, COALESCE(s.color, '#666666') as color, COUNT(c.id) as count
			 FROM contacts c LEFT JOIN crm_stages s ON c.stage_id = s.id
			 WHERE c.user_id = ? GROUP BY c.stage_id, s.name, s.color ORDER BY count DESC`, [userId],
		) as any;

		// New contacts per day (last 14 days)
		const [newContactsPerDay] = await pool.query(
			`SELECT DATE(created_at) as date, COUNT(*) as count
			 FROM contacts WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
			 GROUP BY DATE(created_at) ORDER BY date ASC`, [userId],
		) as any;

		// Top 5 contacts by message count
		const [topContacts] = await pool.query(
			`SELECT c.id, COALESCE(c.name, c.push_name, c.phone) as name, c.phone, COUNT(m.id) as msg_count
			 FROM contacts c JOIN contact_messages m ON c.id = m.contact_id
			 WHERE c.user_id = ? GROUP BY c.id ORDER BY msg_count DESC LIMIT 5`, [userId],
		) as any;

		// Messages by hour of day (response time pattern)
		const [messagesByHour] = await pool.query(
			`SELECT HOUR(created_at) as hour, direction, COUNT(*) as count
			 FROM contact_messages WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
			 GROUP BY HOUR(created_at), direction ORDER BY hour ASC`, [userId],
		) as any;

		// Active instances
		const [[{ connected_instances }]] = await pool.query(
			`SELECT COUNT(*) as connected_instances FROM whatsapp_instances WHERE user_id = ? AND status = 'connected'`, [userId],
		) as any;
		const [[{ total_instances }]] = await pool.query(
			`SELECT COUNT(*) as total_instances FROM whatsapp_instances WHERE user_id = ?`, [userId],
		) as any;

		// Unread contacts count
		const [[{ unread_contacts }]] = await pool.query(
			`SELECT COUNT(*) as unread_contacts FROM contacts WHERE user_id = ? AND (last_read_at IS NULL AND last_message_at IS NOT NULL OR last_message_at > last_read_at)`, [userId],
		) as any;

		return {
			total_contacts: Number(total_contacts),
			total_messages: Number(total_messages),
			incoming: Number(incoming),
			outgoing: Number(outgoing),
			connected_instances: Number(connected_instances),
			total_instances: Number(total_instances),
			unread_contacts: Number(unread_contacts),
			messagesPerDay,
			contactsPerStage,
			newContactsPerDay,
			topContacts,
			messagesByHour,
		};
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

	async reorderStages(userId: number, stageIds: number[]) {
		const pool = this.db.getPool();
		for (let i = 0; i < stageIds.length; i++) {
			await pool.query(
				`UPDATE crm_stages SET position = ? WHERE id = ? AND user_id = ?`,
				[i, stageIds[i], userId],
			);
		}
		return { ok: true };
	}

	async deleteStage(id: number) {
		const pool = this.db.getPool();
		// Move contacts from this stage to null
		await pool.query(`UPDATE contacts SET stage_id = NULL WHERE stage_id = ?`, [id]);
		await pool.query(`DELETE FROM crm_stages WHERE id = ?`, [id]);
	}

	// ==================== CONTACTS ====================

	// Sync group names from Evolution API for groups that have phone number as name
	async syncGroupNames(userId: number) {
		const pool = this.db.getPool();
		const [groups] = await pool.query(
			`SELECT c.id, c.phone, c.name, wi.instance_name
			 FROM contacts c
			 JOIN whatsapp_instances wi ON c.instance_id = wi.id
			 WHERE c.user_id = ? AND c.is_group = 1 AND (c.name = c.phone OR c.name IS NULL OR c.name = '')`,
			[userId],
		);

		const groupsList = groups as any[];
		if (!groupsList.length) return { updated: 0 };

		// Fetch groups from all instances
		const instanceNames = [...new Set(groupsList.map((g) => g.instance_name))];
		const allEvolutionGroups: any[] = [];
		for (const inst of instanceNames) {
			try {
				const evoGroups = await this.whatsapp.getGroups(inst);
				allEvolutionGroups.push(...evoGroups);
			} catch {}
		}

		let updated = 0;
		for (const group of groupsList) {
			const jid = group.phone + "@g.us";
			const evoGroup = allEvolutionGroups.find((g) => g.id === jid || g.id === group.phone);
			if (evoGroup?.name && evoGroup.name !== group.phone) {
				await pool.query(`UPDATE contacts SET name = ? WHERE id = ?`, [evoGroup.name, group.id]);
				this.logger.log(`Synced group name: ${group.phone} -> ${evoGroup.name}`);
				updated++;
			}
		}

		return { updated, total: groupsList.length };
	}

	async getContacts(userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT c.*, cs.name as stage_name, cs.color as stage_color,
			        COALESCE(wi.display_name, wi.instance_name) as instance_name,
			        (SELECT COUNT(*) FROM contact_messages cm
			         WHERE cm.contact_id = c.id
			           AND cm.direction = 'incoming'
			           AND cm.created_at > COALESCE(c.last_read_at, '1970-01-01')
			        ) as unread_count,
			        (SELECT cm2.message_text FROM contact_messages cm2
			         WHERE cm2.contact_id = c.id ORDER BY cm2.created_at DESC LIMIT 1
			        ) as last_message_text,
			        (SELECT cm3.message_type FROM contact_messages cm3
			         WHERE cm3.contact_id = c.id ORDER BY cm3.created_at DESC LIMIT 1
			        ) as last_message_type,
			        (SELECT cm4.direction FROM contact_messages cm4
			         WHERE cm4.contact_id = c.id ORDER BY cm4.created_at DESC LIMIT 1
			        ) as last_message_direction
			 FROM contacts c
			 LEFT JOIN crm_stages cs ON c.stage_id = cs.id
			 LEFT JOIN whatsapp_instances wi ON c.instance_id = wi.id
			 WHERE c.user_id = ?
			 ORDER BY c.pinned DESC, c.last_message_at DESC, c.updated_at DESC`,
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

	// ==================== QUICK REPLIES ====================

	async getQuickReplies(userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT * FROM quick_replies WHERE user_id = ? ORDER BY title ASC`,
			[userId],
		);
		return rows;
	}

	async createQuickReply(userId: number, title: string, message: string, mediaBase64?: string, mediaType?: string) {
		const pool = this.db.getPool();
		const [result] = await pool.query(
			`INSERT INTO quick_replies (user_id, title, message, media_base64, media_type) VALUES (?, ?, ?, ?, ?)`,
			[userId, title, message, mediaBase64 || null, mediaType || null],
		);
		return { id: (result as any).insertId, title, message, media_base64: mediaBase64 || null, media_type: mediaType || null };
	}

	async deleteQuickReply(id: number, userId: number) {
		const pool = this.db.getPool();
		await pool.query(`DELETE FROM quick_replies WHERE id = ? AND user_id = ?`, [id, userId]);
		return { ok: true };
	}

	// ==================== READ STATUS ====================

	async markAsRead(userId: number, contactId: number) {
		const pool = this.db.getPool();
		await pool.query(
			`UPDATE contacts SET last_read_at = NOW() WHERE id = ? AND user_id = ?`,
			[contactId, userId],
		);
		return { ok: true };
	}

	// ==================== PIN ====================

	async togglePin(userId: number, contactId: number, pinned: boolean) {
		const pool = this.db.getPool();
		await pool.query(
			`UPDATE contacts SET pinned = ? WHERE id = ? AND user_id = ?`,
			[pinned ? 1 : 0, contactId, userId],
		);
		return { ok: true, pinned };
	}

	async toggleArchive(userId: number, contactId: number, archived: boolean) {
		const pool = this.db.getPool();
		await pool.query(
			`UPDATE contacts SET archived = ? WHERE id = ? AND user_id = ?`,
			[archived ? 1 : 0, contactId, userId],
		);
		return { ok: true, archived };
	}

	// ==================== MESSAGES ====================

	async getMessages(contactId: number, limit = 50) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT id, contact_id, user_id, direction, message_text, message_type, remote_jid, instance_name, created_at,
			 CASE
			   WHEN message_type IN ('image','video','audio','document') AND raw_data IS NOT NULL THEN 1
			   ELSE 0
			 END as has_media
			 FROM contact_messages WHERE contact_id = ? ORDER BY created_at DESC LIMIT ?`,
			[contactId, limit],
		);
		return (rows as any[]).reverse();
	}

	async getMessageMedia(messageId: number, userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT cm.raw_data, cm.message_type, cm.direction, cm.instance_name
			 FROM contact_messages cm
			 WHERE cm.id = ? AND cm.user_id = ?`,
			[messageId, userId],
		);
		const msg = (rows as any[])[0];
		if (!msg || !msg.raw_data) return null;

		const raw = typeof msg.raw_data === "string" ? JSON.parse(msg.raw_data) : msg.raw_data;

		// Outgoing: base64 stored directly
		if (raw.media_base64) {
			return { base64: raw.media_base64, type: msg.message_type };
		}

		// Incoming from Evolution webhook: extract base64 from message object
		const msgObj = raw.message || raw;
		let base64 = null;
		let mimetype = null;

		// Map message type to possible field names
		const mediaFields = {
			image: ["imageMessage"],
			video: ["videoMessage"],
			audio: ["audioMessage", "pttMessage"],
			document: ["documentMessage"],
		};

		const fields = mediaFields[msg.message_type] || [];
		for (const field of fields) {
			const media = msgObj[field];
			if (media && media.base64) {
				base64 = media.base64;
				mimetype = media.mimetype;
				break;
			}
		}

		// Fallback: try top-level base64
		if (!base64) base64 = msgObj.base64 || raw.base64;

		// Fallback: fetch base64 from Evolution API if not in webhook payload
		if (!base64 && msg.instance_name && raw.key) {
			this.logger.log(`Fetching media from Evolution API for message ${messageId}`);
			const result = await this.whatsapp.getBase64FromMedia(msg.instance_name, raw);
			if (result) {
				base64 = result.base64;
				mimetype = result.mimetype;
			}
		}

		// Fallback mimetype
		if (!mimetype) {
			const defaults = { image: "image/jpeg", video: "video/mp4", audio: "audio/ogg", document: "application/octet-stream" };
			mimetype = defaults[msg.message_type] || "application/octet-stream";
		}

		if (!base64) return null;

		// If base64 doesn't have data URI prefix, add it
		if (!base64.startsWith("data:")) {
			base64 = `data:${mimetype};base64,${base64}`;
		}

		return { base64, type: msg.message_type };
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

		// Use correct JID format: groups use @g.us, individuals use phone number
		const jid = contact.is_group ? `${contact.phone}@g.us` : contact.phone;

		// Send via Evolution
		await this.whatsapp.sendText(contact.instance_name, jid, text);

		// Save to DB
		const remoteJid = contact.is_group ? `${contact.phone}@g.us` : `${contact.phone}@s.whatsapp.net`;
		await pool.query(
			`INSERT INTO contact_messages (contact_id, user_id, direction, message_text, message_type, remote_jid, instance_name)
			 VALUES (?, ?, 'outgoing', ?, 'text', ?, ?)`,
			[contactId, userId, text, remoteJid, contact.instance_name],
		);

		// Update last_message_at
		await pool.query(`UPDATE contacts SET last_message_at = NOW() WHERE id = ?`, [contactId]);

		this.logger.log(`Message sent to ${jid} via ${contact.instance_name}`);
		return { ok: true };
	}

	async sendMedia(userId: number, contactId: number, base64: string, caption: string, mediaType: string) {
		const pool = this.db.getPool();

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

		// Use correct JID format for groups
		const jid = contact.is_group ? `${contact.phone}@g.us` : contact.phone;
		const remoteJid = contact.is_group ? `${contact.phone}@g.us` : `${contact.phone}@s.whatsapp.net`;

		this.logger.log(`Sending ${mediaType} to ${jid} via ${contact.instance_name} (base64 size: ${Math.round(base64.length / 1024)}KB)`);

		// Send via Evolution
		await this.whatsapp.sendMedia(contact.instance_name, jid, base64, caption, mediaType);

		// Save to DB (store base64 in raw_data so we can display it later)
		try {
			await pool.query(
				`INSERT INTO contact_messages (contact_id, user_id, direction, message_text, message_type, remote_jid, instance_name, raw_data)
				 VALUES (?, ?, 'outgoing', ?, ?, ?, ?, ?)`,
				[contactId, userId, caption || `[${mediaType}]`, mediaType, remoteJid, contact.instance_name, JSON.stringify({ media_base64: base64 })],
			);
		} catch (dbErr) {
			// If DB save fails (e.g., packet too large), still consider success since Evolution sent it
			this.logger.error(`DB save failed for media: ${dbErr.message}`);
		}

		await pool.query(`UPDATE contacts SET last_message_at = NOW() WHERE id = ?`, [contactId]);

		this.logger.log(`Media sent to ${jid} via ${contact.instance_name}`);
		return { ok: true };
	}

	// ==================== PROFILE PICTURES ====================

	async fetchProfilePic(contactId: number, userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT c.phone, c.is_group, c.instance_id, c.profile_pic_url, wi.instance_name
			 FROM contacts c
			 LEFT JOIN whatsapp_instances wi ON c.instance_id = wi.id
			 WHERE c.id = ? AND c.user_id = ?`,
			[contactId, userId],
		);
		const contact = (rows as any[])[0];
		if (!contact || !contact.instance_name) return null;

		const jid = contact.is_group
			? `${contact.phone}@g.us`
			: `${contact.phone}@s.whatsapp.net`;

		const picUrl = await this.whatsapp.getProfilePicture(contact.instance_name, jid);
		if (picUrl) {
			await pool.query(`UPDATE contacts SET profile_pic_url = ? WHERE id = ?`, [picUrl, contactId]);
		}
		return picUrl;
	}

	private async updateProfilePicInBackground(contactId: number, userId: number, instanceName: string, phone: string, isGroup: boolean) {
		try {
			const jid = isGroup ? `${phone}@g.us` : `${phone}@s.whatsapp.net`;
			const picUrl = await this.whatsapp.getProfilePicture(instanceName, jid);
			if (picUrl) {
				const pool = this.db.getPool();
				await pool.query(`UPDATE contacts SET profile_pic_url = ? WHERE id = ?`, [picUrl, contactId]);
			}
		} catch {}
	}

	// ==================== WEBHOOK (Evolution) ====================

	async processIncomingMessage(payload: any) {
		const pool = this.db.getPool();

		const event = payload?.event;

		// Handle connection status updates from Evolution webhook
		if (event === "connection.update") {
			const instanceName = payload?.instance;
			const state = payload?.data?.state;
			if (instanceName && state) {
				const status = state === "open" ? "connected" : state === "close" ? "disconnected" : "connecting";
				await pool.query(
					`UPDATE whatsapp_instances SET status = ? WHERE instance_name = ?`,
					[status, instanceName],
				);
				this.logger.log(`Connection update: ${instanceName} -> ${status}`);
			}
			return { ok: true };
		}

		if (event !== "messages.upsert") return { ignored: true };

		const data = payload?.data;
		if (!data) return { ignored: true };

		const instanceName = payload?.instance;
		this.logger.log(`Webhook received: event=${event}, instance=${instanceName}, remoteJid=${data?.key?.remoteJid}, fromMe=${data?.key?.fromMe}`);
		const remoteJid = data?.key?.remoteJid;
		const fromMe = data?.key?.fromMe;
		const pushName = data?.pushName || payload?.data?.pushName || null;
		const messageText =
			data?.message?.conversation ||
			data?.message?.extendedTextMessage?.text ||
			data?.message?.imageMessage?.caption ||
			data?.message?.videoMessage?.caption ||
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

		// Skip status broadcasts and @lid (linked device) messages
		if (!remoteJid || remoteJid === "status@broadcast" || remoteJid.includes("@lid")) {
			return { ignored: true };
		}

		const isGroup = remoteJid.includes("@g.us");

		// Extract phone/group ID from jid
		const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "").replace("@g.us", "");

		// Find instance + user (search by instance_name, instance_key, or display_name)
		const [instances] = await pool.query(
			`SELECT id, user_id FROM whatsapp_instances
			 WHERE instance_name = ? OR instance_key = ? OR display_name = ?
			 LIMIT 1`,
			[instanceName, instanceName, instanceName],
		);
		const instance = (instances as any[])[0];
		if (!instance) {
			this.logger.warn(`Webhook: instance not found for name="${instanceName}"`);
			return { ignored: true, reason: "instance not found" };
		}

		const userId = instance.user_id;
		const instanceId = instance.id;

		// Get default stage
		const stages = await this.getStages(userId);
		const firstStage = (stages as any[])[0];

		// For groups, extract group name from metadata or fetch from Evolution API
		// For individuals, don't auto-set name from pushName - only show phone until user saves a name
		let contactName: string | null = isGroup
			? (payload?.data?.groupMetadata?.subject || data?.groupMetadata?.subject || data?.groupJid?.subject || null)
			: null;

		// If group name not in webhook, try fetching from Evolution API
		if (isGroup && !contactName && instanceName) {
			try {
				const groups = await this.whatsapp.getGroups(instanceName);
				const group = groups.find((g: any) => g.id === remoteJid || g.id === phone + "@g.us");
				if (group) contactName = group.name;
			} catch {}
		}

		// Track if we have a real group name (not just the phone fallback)
		const hasRealGroupName = isGroup && !!contactName;
		if (isGroup && !contactName) contactName = phone;

		if (isGroup) {
			if (hasRealGroupName) {
				// We have a real group name - always update it
				await pool.query(
					`INSERT INTO contacts (user_id, instance_id, phone, is_group, name, stage_id, last_message_at)
					 VALUES (?, ?, ?, 1, ?, NULL, NOW())
					 ON DUPLICATE KEY UPDATE
					   name = VALUES(name),
					   last_message_at = NOW(),
					   updated_at = NOW()`,
					[userId, instanceId, phone, contactName],
				);
			} else {
				// No real name - only set name on first insert, don't overwrite existing
				await pool.query(
					`INSERT INTO contacts (user_id, instance_id, phone, is_group, name, stage_id, last_message_at)
					 VALUES (?, ?, ?, 1, ?, NULL, NOW())
					 ON DUPLICATE KEY UPDATE
					   last_message_at = NOW(),
					   updated_at = NOW()`,
					[userId, instanceId, phone, contactName],
				);
			}
		} else {
			// Individual contacts: unique per (user_id, phone, instance_id)
			// Same person on different instances = separate contacts
			const [existing] = await pool.query(
				`SELECT id FROM contacts WHERE user_id = ? AND phone = ? AND instance_id = ? AND is_group = 0 LIMIT 1`,
				[userId, phone, instanceId],
			);
			const existingContact = (existing as any[])[0];

			if (existingContact) {
				// Update push_name (WhatsApp display name) but don't touch user-set name
				await pool.query(
					`UPDATE contacts SET
					   push_name = COALESCE(?, push_name),
					   last_message_at = NOW(),
					   updated_at = NOW()
					 WHERE id = ?`,
					[pushName || null, existingContact.id],
				);
			} else {
				// Create new contact - name stays NULL, push_name stores WhatsApp name
				await pool.query(
					`INSERT INTO contacts (user_id, instance_id, phone, is_group, name, push_name, stage_id, last_message_at)
					 VALUES (?, ?, ?, 0, NULL, ?, ?, NOW())`,
					[userId, instanceId, phone, pushName || null, firstStage?.id || null],
				);
			}
		}

		// Get contact ID - always filter by instance
		const [foundContacts] = await pool.query(
			`SELECT id, profile_pic_url FROM contacts WHERE user_id = ? AND phone = ? AND instance_id = ? AND is_group = ? LIMIT 1`,
			[userId, phone, instanceId, isGroup ? 1 : 0],
		);
		const contact = (foundContacts as any[])[0];
		if (!contact) return { ignored: true };

		// Fetch profile pic in background if not yet stored
		if (!contact.profile_pic_url) {
			this.updateProfilePicInBackground(contact.id, userId, instanceName, phone, isGroup);
		}

		// Log media info for debugging
		if (messageType !== "text") {
			const msg = data?.message || {};
			const mediaKey = messageType === "image" ? "imageMessage" : messageType === "video" ? "videoMessage" : messageType === "audio" ? "audioMessage" : "documentMessage";
			const hasBase64 = !!(msg[mediaKey]?.base64);
			this.logger.log(`Media message: type=${messageType}, hasBase64=${hasBase64}, keys=${Object.keys(msg).join(",")}`);
		}

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

		// Emit real-time event (SSE) - include all data needed for instant UI update
		this.events.emit({
			userId,
			type: "new_message",
			data: {
				contactId: contact.id,
				phone,
				contactName: contactName || pushName || phone,
				messageText,
				messageType,
				direction: fromMe ? "outgoing" : "incoming",
				instanceName,
				instanceId: instanceId,
				isGroup: isGroup,
				createdAt: new Date().toISOString(),
			},
		});

		// Send Web Push notification for incoming messages (fire-and-forget, don't block response)
		if (!fromMe) {
			const title = contactName || pushName || phone;
			const body = messageType !== "text"
				? `[${messageType}] ${messageText || ""}`
				: messageText || "Nova mensagem";
			// Don't await - send in background for speed
			this.push.sendToUser(userId, {
				title,
				body: body.slice(0, 100),
				data: { contactId: contact.id, url: "/app/conversations" },
			}).catch((err) => this.logger.error(`Push error: ${err.message}`));

			// AI auto-reply (fire-and-forget)
			if (this.aiService) {
				this.aiService.handleIncomingMessage({
					userId,
					contactId: contact.id,
					instanceId: instanceId,
					instanceName,
					phone,
					isGroup,
					messageText,
					contactName: contactName || pushName || null,
				}).catch((err) => this.logger.error(`AI error: ${err.message}`));
			}
		}

		return { ok: true, contactId: contact.id, phone };
	}
}
