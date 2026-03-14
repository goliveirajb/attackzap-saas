import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { DatabaseModule } from "~/database/database.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
	imports: [
		PassportModule,
		JwtModule.register({
			secret: process.env.JWT_SECRET || "attackzap-secret-dev",
			signOptions: { expiresIn: "7d" },
		}),
		DatabaseModule,
	],
	providers: [AuthService, JwtStrategy, JwtAuthGuard],
	controllers: [AuthController],
	exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
