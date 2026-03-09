import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { DatabaseService } from "~/database/database.service";
import { CronJob } from "cron";
import { DateTime } from "luxon";

@Injectable()
export class AutomationsService implements OnModuleInit {
	private readonly logger = new Logger(AutomationsService.name);

	constructor(
		private readonly db: DatabaseService,
		private readonly schedulerRegistry: SchedulerRegistry,
	) {}

	async onModuleInit() {
		setTimeout(async () => {
			try {
				await this.agendarMensagens();
				this.logger.log("Mensagens programadas inicializadas.");
			} catch (err) {
				this.logger.error(`Erro ao inicializar mensagens: ${err.message}`);
			}
		}, 5000);
	}

	// ===================== CRUD Mensagens Programadas =====================

	async listarMensagens(userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT sm.*, a.name as automation_name, a.n8n_webhook_url, wi.instance_name
			 FROM scheduled_messages sm
			 LEFT JOIN automations a ON sm.automation_id = a.id
			 LEFT JOIN whatsapp_instances wi ON a.instance_id = wi.id
			 WHERE sm.user_id = ?
			 ORDER BY sm.horario ASC`,
			[userId],
		);
		return rows;
	}

	async criarMensagem(
		userId: number,
		automationId: number,
		horario: string,
		messageText: string,
		targetNumbers: string,
		diasSemana?: string,
	) {
		const pool = this.db.getPool();
		const dias = diasSemana || "0,1,2,3,4,5,6";

		const [result] = await pool.query(
			`INSERT INTO scheduled_messages (automation_id, user_id, horario, message_text, target_numbers, dias_semana)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[automationId, userId, horario, messageText, targetNumbers, dias],
		);

		await this.agendarMensagens();

		return {
			id: (result as any).insertId,
			horario,
			messageText,
			targetNumbers,
			dias_semana: dias,
		};
	}

	async atualizarMensagem(
		id: number,
		data: {
			horario?: string;
			message_text?: string;
			target_numbers?: string;
			dias_semana?: string;
			active?: number;
		},
	) {
		const pool = this.db.getPool();
		const fields: string[] = [];
		const values: any[] = [];

		if (data.horario !== undefined) { fields.push("horario = ?"); values.push(data.horario); }
		if (data.message_text !== undefined) { fields.push("message_text = ?"); values.push(data.message_text); }
		if (data.target_numbers !== undefined) { fields.push("target_numbers = ?"); values.push(data.target_numbers); }
		if (data.dias_semana !== undefined) { fields.push("dias_semana = ?"); values.push(data.dias_semana); }
		if (data.active !== undefined) { fields.push("active = ?"); values.push(data.active); }

		if (fields.length === 0) return { message: "Nenhum campo para atualizar" };

		values.push(id);
		await pool.query(`UPDATE scheduled_messages SET ${fields.join(", ")} WHERE id = ?`, values);
		await this.agendarMensagens();

		return { message: "Atualizado com sucesso" };
	}

	async deletarMensagem(id: number) {
		const pool = this.db.getPool();
		await pool.query(`DELETE FROM scheduled_messages WHERE id = ?`, [id]);
		await this.agendarMensagens();
		return { message: "Deletado com sucesso" };
	}

	async salvarImagem(id: number, base64ComMime: string) {
		const pool = this.db.getPool();

		const [rows] = await pool.query(`SELECT id FROM scheduled_messages WHERE id = ?`, [id]);
		if (!(rows as any[])[0]) return { error: "Mensagem nao encontrada" };

		await pool.query(`UPDATE scheduled_messages SET media_base64 = ? WHERE id = ?`, [base64ComMime, id]);
		this.logger.log(`Imagem salva para mensagem #${id}`);

		await this.agendarMensagens();
		return { message: "Imagem salva com sucesso" };
	}

	async removerImagem(id: number) {
		const pool = this.db.getPool();
		await pool.query(`UPDATE scheduled_messages SET media_base64 = NULL WHERE id = ?`, [id]);
		await this.agendarMensagens();
		return { message: "Imagem removida" };
	}

	// ===================== Cron Scheduling =====================

	async agendarMensagens() {
		// Limpar jobs antigos
		const jobs = this.schedulerRegistry.getCronJobs();
		for (const name of jobs.keys()) {
			if (name.startsWith("sched-msg-")) {
				jobs.get(name)?.stop();
				this.schedulerRegistry.deleteCronJob(name);
			}
		}

		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT sm.*, a.n8n_webhook_url, wi.instance_name
			 FROM scheduled_messages sm
			 LEFT JOIN automations a ON sm.automation_id = a.id
			 LEFT JOIN whatsapp_instances wi ON a.instance_id = wi.id
			 WHERE sm.active = 1`,
		);

		const mensagens = rows as any[];
		const logs: string[] = [];

		for (const msg of mensagens) {
			if (!msg.n8n_webhook_url) continue;

			const [hh, mm, ss] = String(msg.horario).split(":").map(Number);

			const horaBR = DateTime.fromObject(
				{ hour: hh || 0, minute: mm || 0, second: ss || 0 },
				{ zone: "America/Sao_Paulo" },
			);

			const horaServidor = horaBR.setZone("local");
			const diasSemana = msg.dias_semana || "0,1,2,3,4,5,6";
			const cronExpression = `${horaServidor.second} ${horaServidor.minute} ${horaServidor.hour} * * ${diasSemana}`;
			const jobName = `sched-msg-${msg.id}`;
			const msgId = msg.id;

			const job = new CronJob(cronExpression, async () => {
				await this.enviarMensagem(msgId);
			});

			this.schedulerRegistry.addCronJob(jobName, job);
			job.start();

			logs.push(`#${msg.id} -> ${msg.horario} (BR) dias=[${diasSemana}] cron=${cronExpression}`);
		}

		if (logs.length > 0) {
			this.logger.log(`Mensagens agendadas:\n${logs.join("\n")}`);
		} else {
			this.logger.log("Nenhuma mensagem ativa para agendar.");
		}
	}

	private async enviarMensagem(msgId: number) {
		const pool = this.db.getPool();

		const [rows] = await pool.query(
			`SELECT sm.*, a.n8n_webhook_url
			 FROM scheduled_messages sm
			 LEFT JOIN automations a ON sm.automation_id = a.id
			 WHERE sm.id = ? AND sm.active = 1`,
			[msgId],
		);

		const msg = (rows as any[])[0];
		if (!msg || !msg.n8n_webhook_url) {
			this.logger.warn(`Mensagem #${msgId} não encontrada ou sem webhook.`);
			return;
		}

		const numbers = String(msg.target_numbers || "")
			.split(",")
			.map((n) => n.trim())
			.filter(Boolean);

		const descricao = msg.message_text?.trim() || `Mensagem programada #${msg.id}`;

		for (const number of numbers) {
			try {
				const payload = {
					number,
					text: msg.media_base64 ? "" : descricao,
					media: msg.media_base64 || "",
					caption: msg.media_base64 ? descricao : "",
				};

				this.logger.log(`Enviando #${msg.id} ${msg.media_base64 ? "IMAGEM" : "TEXTO"} para ${number}`);

				const response = await fetch(msg.n8n_webhook_url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
					signal: AbortSignal.timeout(30000),
				});

				this.logger.log(`Mensagem #${msg.id} enviada para ${number}. Status: ${response.status}`);
			} catch (err) {
				this.logger.error(`Erro ao enviar #${msg.id} para ${number}: ${err.message}`);
			}
		}
	}
}
