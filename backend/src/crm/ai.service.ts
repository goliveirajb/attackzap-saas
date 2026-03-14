import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "~/database/database.service";
import { WhatsappService } from "~/whatsapp/whatsapp.service";
import { CrmEventsService } from "./crm-events.service";

@Injectable()
export class AiService {
	private readonly logger = new Logger(AiService.name);

	constructor(
		private readonly db: DatabaseService,
		private readonly whatsapp: WhatsappService,
		private readonly events: CrmEventsService,
	) {}

	// ==================== CONFIG ====================

	async getConfig(userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT * FROM ai_config WHERE user_id = ?`, [userId],
		);
		const config = (rows as any[])[0];
		if (!config) return null;
		// Don't send full API key to frontend
		return {
			...config,
			openai_key: config.openai_key ? "sk-...configurado" : null,
		};
	}

	async saveConfig(userId: number, data: {
		openai_key?: string;
		model?: string;
		system_prompt?: string;
		active?: boolean;
		ignore_groups?: boolean;
		max_context_messages?: number;
		response_delay_ms?: number;
		pause_after_human_mins?: number;
	}) {
		const pool = this.db.getPool();

		// Check if config exists
		const [existing] = await pool.query(`SELECT id FROM ai_config WHERE user_id = ?`, [userId]);
		if ((existing as any[]).length > 0) {
			const fields: string[] = [];
			const values: any[] = [];

			if (data.openai_key !== undefined && data.openai_key !== "sk-...configurado") {
				fields.push("openai_key = ?"); values.push(data.openai_key);
			}
			if (data.model !== undefined) { fields.push("model = ?"); values.push(data.model); }
			if (data.system_prompt !== undefined) { fields.push("system_prompt = ?"); values.push(data.system_prompt); }
			if (data.active !== undefined) { fields.push("active = ?"); values.push(data.active ? 1 : 0); }
			if (data.ignore_groups !== undefined) { fields.push("ignore_groups = ?"); values.push(data.ignore_groups ? 1 : 0); }
			if (data.max_context_messages !== undefined) { fields.push("max_context_messages = ?"); values.push(data.max_context_messages); }
			if (data.response_delay_ms !== undefined) { fields.push("response_delay_ms = ?"); values.push(data.response_delay_ms); }
			if (data.pause_after_human_mins !== undefined) { fields.push("pause_after_human_mins = ?"); values.push(data.pause_after_human_mins); }

			if (fields.length > 0) {
				values.push(userId);
				await pool.query(`UPDATE ai_config SET ${fields.join(", ")} WHERE user_id = ?`, values);
			}
		} else {
			await pool.query(
				`INSERT INTO ai_config (user_id, openai_key, model, system_prompt, active, ignore_groups, max_context_messages, response_delay_ms, pause_after_human_mins)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					userId,
					data.openai_key || null,
					data.model || "gpt-4o-mini",
					data.system_prompt || "",
					data.active ? 1 : 0,
					data.ignore_groups ? 1 : 0,
					data.max_context_messages || 10,
					data.response_delay_ms || 2000,
					data.pause_after_human_mins || 30,
				],
			);
		}

		return { ok: true };
	}

	// ==================== AI INSTANCES (per-instance toggle) ====================

	async getInstanceToggles(userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT wi.id, wi.instance_name, COALESCE(wi.display_name, wi.instance_name) as display_name,
			        COALESCE(ait.active, 0) as ai_active
			 FROM whatsapp_instances wi
			 LEFT JOIN ai_instance_toggle ait ON wi.id = ait.instance_id
			 WHERE wi.user_id = ?`, [userId],
		);
		return rows;
	}

	async toggleInstance(userId: number, instanceId: number, active: boolean) {
		const pool = this.db.getPool();
		// Verify ownership
		const [inst] = await pool.query(`SELECT id FROM whatsapp_instances WHERE id = ? AND user_id = ?`, [instanceId, userId]);
		if (!(inst as any[]).length) return { error: "Instancia nao encontrada" };

		await pool.query(
			`INSERT INTO ai_instance_toggle (instance_id, active) VALUES (?, ?)
			 ON DUPLICATE KEY UPDATE active = ?`,
			[instanceId, active ? 1 : 0, active ? 1 : 0],
		);
		return { ok: true };
	}

	// ==================== AI RESPONSE LOGIC ====================

	async handleIncomingMessage(params: {
		userId: number;
		contactId: number;
		instanceId: number;
		instanceName: string;
		phone: string;
		isGroup: boolean;
		messageText: string;
		contactName: string | null;
	}) {
		const { userId, contactId, instanceId, instanceName, phone, isGroup, messageText, contactName } = params;
		const pool = this.db.getPool();

		this.logger.log(`AI check: user=${userId}, contact=${contactId}, instance=${instanceId} (${instanceName}), phone=${phone}, isGroup=${isGroup}`);

		// 1. Get AI config
		const [cfgRows] = await pool.query(`SELECT * FROM ai_config WHERE user_id = ? AND active = 1`, [userId]);
		const config = (cfgRows as any[])[0];
		if (!config) { this.logger.log(`AI skip: no active config for user ${userId}`); return; }
		if (!config.openai_key) { this.logger.log(`AI skip: no OpenAI key for user ${userId}`); return; }

		// 2. Check ignore groups
		if (isGroup && config.ignore_groups) { this.logger.log(`AI skip: ignoring group ${phone}`); return; }

		// 3. Check instance toggle
		const [toggleRows] = await pool.query(
			`SELECT active FROM ai_instance_toggle WHERE instance_id = ?`, [instanceId],
		);
		const toggle = (toggleRows as any[])[0];
		if (!toggle) { this.logger.log(`AI skip: no toggle found for instance ${instanceId}`); return; }
		if (!toggle.active) { this.logger.log(`AI skip: instance ${instanceId} toggle is off`); return; }

		// 4. Check if human responded recently (pause AI)
		if (config.pause_after_human_mins > 0) {
			const [humanMsgs] = await pool.query(
				`SELECT 1 FROM contact_messages
				 WHERE contact_id = ? AND direction = 'outgoing'
				 AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
				 AND message_text NOT LIKE '[IA]%'
				 LIMIT 1`,
				[contactId, config.pause_after_human_mins],
			);
			if ((humanMsgs as any[]).length > 0) {
				this.logger.log(`AI skip: human replied within ${config.pause_after_human_mins}min for contact ${contactId}`);
				return;
			}
		}

		// 5. Skip empty messages
		if (!messageText || messageText.trim().length === 0) { this.logger.log(`AI skip: empty message`); return; }

		this.logger.log(`AI proceeding: will call OpenAI for contact ${contactId}, text="${messageText.slice(0, 50)}..."`);

		// 6. Get conversation context
		const contextLimit = config.max_context_messages || 10;
		const [contextRows] = await pool.query(
			`SELECT direction, message_text, message_type, created_at
			 FROM contact_messages WHERE contact_id = ?
			 ORDER BY created_at DESC LIMIT ?`,
			[contactId, contextLimit],
		);
		const contextMessages = (contextRows as any[]).reverse();

		// 7. Build OpenAI messages
		const messages: any[] = [
			{
				role: "system",
				content: config.system_prompt || "Voce e um assistente de atendimento ao cliente. Responda de forma cordial e objetiva em portugues.",
			},
		];

		for (const msg of contextMessages) {
			if (msg.message_type !== "text" || !msg.message_text) continue;
			messages.push({
				role: msg.direction === "incoming" ? "user" : "assistant",
				content: msg.message_text.replace(/^\[IA\] /, ""),
			});
		}

		// 8. Delay before responding (looks more natural)
		if (config.response_delay_ms > 0) {
			await new Promise((r) => setTimeout(r, config.response_delay_ms));
		}

		// 9. Call OpenAI
		let aiResponse: string;
		try {
			const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${config.openai_key}`,
				},
				body: JSON.stringify({
					model: config.model || "gpt-4o-mini",
					messages,
					max_tokens: 500,
					temperature: 0.7,
				}),
			});

			if (!openaiRes.ok) {
				const errText = await openaiRes.text().catch(() => "");
				this.logger.error(`OpenAI API error (${openaiRes.status}): ${errText}`);
				return;
			}

			const openaiData = await openaiRes.json();
			aiResponse = openaiData?.choices?.[0]?.message?.content?.trim();
			if (!aiResponse) return;
		} catch (err) {
			this.logger.error(`OpenAI call failed: ${err.message}`);
			return;
		}

		// 10. Send response via WhatsApp
		try {
			const jid = isGroup ? `${phone}@g.us` : phone;
			await this.whatsapp.sendText(instanceName, jid, aiResponse);

			// Save to DB
			const remoteJid = isGroup ? `${phone}@g.us` : `${phone}@s.whatsapp.net`;
			await pool.query(
				`INSERT INTO contact_messages (contact_id, user_id, direction, message_text, message_type, remote_jid, instance_name)
				 VALUES (?, ?, 'outgoing', ?, 'text', ?, ?)`,
				[contactId, userId, `[IA] ${aiResponse}`, remoteJid, instanceName],
			);

			// Update last_message_at
			await pool.query(`UPDATE contacts SET last_message_at = NOW() WHERE id = ?`, [contactId]);

			// Emit SSE event
			this.events.emit({
				userId,
				type: "new_message",
				data: {
					contactId,
					phone,
					contactName: contactName || phone,
					messageText: `[IA] ${aiResponse}`,
					messageType: "text",
					direction: "outgoing",
					instanceName,
					instanceId,
					isGroup,
					createdAt: new Date().toISOString(),
				},
			});

			this.logger.log(`AI responded to ${phone} via ${instanceName}`);
		} catch (err) {
			this.logger.error(`AI send failed: ${err.message}`);
		}
	}
}
