import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { DatabaseService } from "~/database/database.service";
import { WhatsappService } from "~/whatsapp/whatsapp.service";
import { CronJob } from "cron";
import { DateTime } from "luxon";

@Injectable()
export class AutomationsService implements OnModuleInit {
	private readonly logger = new Logger(AutomationsService.name);

	constructor(
		private readonly db: DatabaseService,
		private readonly whatsapp: WhatsappService,
		private readonly schedulerRegistry: SchedulerRegistry,
	) {}

	async onModuleInit() {
		setTimeout(() => this.scheduleAll(), 5000);
	}

	// Criar mensagem programada
	async createScheduledMessage(
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

		await this.scheduleAll();

		return { id: (result as any).insertId, horario, messageText };
	}

	// Listar mensagens programadas do usuario
	async listByUser(userId: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT sm.*, a.name as automation_name, wi.instance_name
			 FROM scheduled_messages sm
			 LEFT JOIN automations a ON sm.automation_id = a.id
			 LEFT JOIN whatsapp_instances wi ON a.instance_id = wi.id
			 WHERE sm.user_id = ?
			 ORDER BY sm.horario ASC`,
			[userId],
		);
		return rows;
	}

	// Deletar mensagem
	async deleteMessage(messageId: number) {
		const pool = this.db.getPool();
		await pool.query(`DELETE FROM scheduled_messages WHERE id = ?`, [messageId]);
		await this.scheduleAll();
		return { deleted: true };
	}

	// Agendar todas as mensagens ativas
	async scheduleAll() {
		// Limpa jobs anteriores
		const jobs = this.schedulerRegistry.getCronJobs();
		for (const name of jobs.keys()) {
			if (name.startsWith("sched-msg-")) {
				jobs.get(name)?.stop();
				this.schedulerRegistry.deleteCronJob(name);
			}
		}

		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT sm.*, a.instance_id, wi.instance_name
			 FROM scheduled_messages sm
			 LEFT JOIN automations a ON sm.automation_id = a.id
			 LEFT JOIN whatsapp_instances wi ON a.instance_id = wi.id
			 WHERE sm.active = 1`,
		);

		const messages = rows as any[];

		for (const msg of messages) {
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
			const instanceName = msg.instance_name;

			const job = new CronJob(cronExpression, async () => {
				await this.executeSend(msgId, instanceName);
			});

			this.schedulerRegistry.addCronJob(jobName, job);
			job.start();

			this.logger.log(`Scheduled #${msg.id} -> ${msg.horario} (cron: ${cronExpression})`);
		}
	}

	private async executeSend(msgId: number, instanceName: string) {
		if (!instanceName) return;

		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT * FROM scheduled_messages WHERE id = ? AND active = 1`,
			[msgId],
		);

		const msg = (rows as any[])[0];
		if (!msg) return;

		const numbers = String(msg.target_numbers || "")
			.split(",")
			.map((n) => n.trim())
			.filter(Boolean);

		for (const number of numbers) {
			try {
				if (msg.media_base64) {
					await this.whatsapp.sendMedia(
						instanceName,
						number,
						msg.media_base64,
						msg.message_text || "",
					);
				} else {
					await this.whatsapp.sendText(
						instanceName,
						number,
						msg.message_text || "",
					);
				}
				this.logger.log(`Sent #${msg.id} to ${number}`);
			} catch (err) {
				this.logger.error(`Failed #${msg.id} to ${number}: ${err.message}`);
			}
		}
	}
}
