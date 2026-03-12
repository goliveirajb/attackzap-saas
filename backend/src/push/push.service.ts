import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "~/database/database.service";
import * as webPush from "web-push";

@Injectable()
export class PushService implements OnModuleInit {
	private readonly logger = new Logger(PushService.name);

	// VAPID keys - override via env vars in production
	private readonly vapidPublic = process.env.VAPID_PUBLIC_KEY || "BNC_ClcOn3piFp2ZR3zR7lz-SiQr2hp0VW0OCDGTh7Ue21ScCg5GsAUQMPGyxpnOrfHqSPKcCPTff28ojGsqAhs";
	private readonly vapidPrivate = process.env.VAPID_PRIVATE_KEY || "KRpQR4CKCoVUrJlDgOHqgzbV6vTUcQ6A9QQzpyUHBtg";

	constructor(private readonly db: DatabaseService) {}

	async onModuleInit() {
		webPush.setVapidDetails(
			"mailto:contato@attackzap.com",
			this.vapidPublic,
			this.vapidPrivate,
		);
	}

	getPublicKey(): string {
		return this.vapidPublic;
	}

	async saveSubscription(userId: number, subscription: any) {
		const pool = this.db.getPool();
		const endpoint = subscription.endpoint;
		const json = JSON.stringify(subscription);

		await pool.query(
			`INSERT INTO push_subscriptions (user_id, endpoint, subscription_json)
			 VALUES (?, ?, ?)
			 ON DUPLICATE KEY UPDATE subscription_json = VALUES(subscription_json), updated_at = NOW()`,
			[userId, endpoint, json],
		);
		this.logger.log(`Push subscription saved for user ${userId}`);
	}

	async removeSubscription(userId: number, endpoint: string) {
		const pool = this.db.getPool();
		await pool.query(
			`DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`,
			[userId, endpoint],
		);
	}

	async sendToUser(userId: number, payload: { title: string; body: string; data?: any }) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT id, subscription_json FROM push_subscriptions WHERE user_id = ?`,
			[userId],
		);
		const subs = rows as any[];
		if (subs.length === 0) return;

		const message = JSON.stringify(payload);

		for (const sub of subs) {
			try {
				const subscription = JSON.parse(sub.subscription_json);
				await webPush.sendNotification(subscription, message);
			} catch (err: any) {
				// Remove expired/invalid subscriptions
				if (err.statusCode === 404 || err.statusCode === 410) {
					await pool.query(`DELETE FROM push_subscriptions WHERE id = ?`, [sub.id]);
					this.logger.log(`Removed expired subscription ${sub.id}`);
				} else {
					this.logger.error(`Push failed for sub ${sub.id}: ${err.message}`);
				}
			}
		}
	}
}
