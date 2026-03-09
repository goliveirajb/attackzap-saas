import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "~/auth/jwt-auth.guard";
import { DatabaseService } from "~/database/database.service";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
	constructor(private readonly db: DatabaseService) {}

	@Get("me")
	async me(@Req() req) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT id, name, email, plan, created_at FROM users WHERE id = ?`,
			[req.user.id],
		);
		return (rows as any[])[0] || null;
	}
}
