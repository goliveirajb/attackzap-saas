import { Controller, Post, Body, HttpException, HttpStatus } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post("register")
	async register(@Body() body: { name: string; email: string; password: string; plan?: string }) {
		try {
			return await this.authService.register(body.name, body.email, body.password, body.plan);
		} catch (err) {
			throw new HttpException(
				err.message || "Erro ao registrar",
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	@Post("login")
	async login(@Body() body: { email: string; password: string }) {
		try {
			return await this.authService.login(body.email, body.password);
		} catch (err) {
			throw new HttpException(
				err.message || "Credenciais invalidas",
				HttpStatus.UNAUTHORIZED,
			);
		}
	}
}
