import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "~/database/database.service";

@Injectable()
export class AdminService {
	private readonly logger = new Logger(AdminService.name);

	constructor(private readonly db: DatabaseService) {}

	async getUsers() {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT u.id, u.name, u.email, u.plan, u.role, u.active, u.created_at, u.updated_at,
			        (SELECT COUNT(*) FROM whatsapp_instances WHERE user_id = u.id) as instances_count,
			        (SELECT COUNT(*) FROM contacts WHERE user_id = u.id) as contacts_count
			 FROM users u ORDER BY u.created_at DESC`,
		);
		return rows;
	}

	async getUser(id: number) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT id, name, email, plan, role, active, created_at, updated_at FROM users WHERE id = ?`,
			[id],
		);
		return (rows as any[])[0] || null;
	}

	async updateUser(id: number, data: { name?: string; email?: string; plan?: string; role?: string; active?: number }) {
		const pool = this.db.getPool();
		const fields: string[] = [];
		const values: any[] = [];

		if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
		if (data.email !== undefined) { fields.push("email = ?"); values.push(data.email); }
		if (data.plan !== undefined) { fields.push("plan = ?"); values.push(data.plan); }
		if (data.role !== undefined) { fields.push("role = ?"); values.push(data.role); }
		if (data.active !== undefined) { fields.push("active = ?"); values.push(data.active); }

		if (fields.length === 0) return;
		values.push(id);
		await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
		this.logger.log(`User ${id} updated: ${fields.join(", ")}`);
	}

	async deleteUser(id: number) {
		const pool = this.db.getPool();
		await pool.query(`DELETE FROM users WHERE id = ?`, [id]);
		this.logger.log(`User ${id} deleted`);
	}

	async getStats() {
		const pool = this.db.getPool();
		const [[totalUsers]] = await pool.query(`SELECT COUNT(*) as count FROM users`) as any;
		const [[activeUsers]] = await pool.query(`SELECT COUNT(*) as count FROM users WHERE active = 1`) as any;
		const [[totalInstances]] = await pool.query(`SELECT COUNT(*) as count FROM whatsapp_instances`) as any;
		const [[connectedInstances]] = await pool.query(`SELECT COUNT(*) as count FROM whatsapp_instances WHERE status = 'connected'`) as any;
		const [[totalContacts]] = await pool.query(`SELECT COUNT(*) as count FROM contacts`) as any;
		const [[totalMessages]] = await pool.query(`SELECT COUNT(*) as count FROM contact_messages`) as any;

		const [planCounts] = await pool.query(
			`SELECT plan, COUNT(*) as count FROM users GROUP BY plan`,
		);

		return {
			totalUsers: totalUsers.count,
			activeUsers: activeUsers.count,
			totalInstances: totalInstances.count,
			connectedInstances: connectedInstances.count,
			totalContacts: totalContacts.count,
			totalMessages: totalMessages.count,
			planCounts,
		};
	}
}
