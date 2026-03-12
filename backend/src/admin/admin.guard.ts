import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { DatabaseService } from "~/database/database.service";

@Injectable()
export class AdminGuard implements CanActivate {
	constructor(private readonly db: DatabaseService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const userId = request.user?.id;
		if (!userId) throw new ForbiddenException("Nao autenticado");

		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT role FROM users WHERE id = ?`,
			[userId],
		);
		const user = (rows as any[])[0];
		if (!user || user.role !== "admin") {
			throw new ForbiddenException("Acesso restrito a administradores");
		}
		return true;
	}
}
