import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor() {
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
		return { id: payload.id, email: payload.email };
	}
}
