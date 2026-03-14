import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DatabaseService } from "~/database/database.service";
import * as bcrypt from "bcrypt";

@Injectable()
export class AuthService {
	constructor(
		private readonly db: DatabaseService,
		private readonly jwtService: JwtService,
	) {}

	async register(name: string, email: string, password: string, plan?: string) {
		const pool = this.db.getPool();
		const hash = await bcrypt.hash(password, 10);
		const userPlan = plan || "free";

		const [result] = await pool.query(
			`INSERT INTO users (name, email, password, plan) VALUES (?, ?, ?, ?)`,
			[name, email, hash, userPlan],
		);

		const userId = (result as any).insertId;
		const token = this.jwtService.sign({ id: userId, email });

		return { token, user: { id: userId, name, email, plan: userPlan, role: "user" } };
	}

	async login(email: string, password: string) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT id, name, email, password, plan, role, active FROM users WHERE email = ?`,
			[email],
		);

		const user = (rows as any[])[0];
		if (!user) throw new Error("Credenciais invalidas");

		const valid = await bcrypt.compare(password, user.password);
		if (!valid) throw new Error("Credenciais invalidas");

		if (!user.active) throw new Error("Conta desativada");

		const token = this.jwtService.sign({ id: user.id, email: user.email });

		return {
			token,
			user: { id: user.id, name: user.name, email: user.email, plan: user.plan, role: user.role || "user" },
		};
	}
}
