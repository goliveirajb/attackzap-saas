import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { DatabaseService } from "~/database/database.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(private readonly db: DatabaseService) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				ExtractJwt.fromAuthHeaderAsBearerToken(),
				(req) => req?.query?.token || null,
			]),
			ignoreExpiration: false,
			secretOrKey: process.env.JWT_SECRET || "attackzap-secret-dev",
		});
	}

	async validate(payload: any) {
		const pool = this.db.getPool();
		const [rows] = await pool.query(
			`SELECT id, email, active FROM users WHERE id = ?`,
			[payload.id],
		);
		const user = (rows as any[])[0];
		if (!user || !user.active) {
			throw new UnauthorizedException("Conta desativada");
		}
		return { id: user.id, email: user.email };
	}
}
