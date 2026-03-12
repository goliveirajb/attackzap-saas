import { Controller, Get, Put, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { JwtAuthGuard } from "~/auth/jwt-auth.guard";
import { AdminGuard } from "./admin.guard";

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
	constructor(private readonly svc: AdminService) {}

	@Get("stats")
	async getStats() {
		return this.svc.getStats();
	}

	@Get("users")
	async getUsers() {
		return this.svc.getUsers();
	}

	@Get("users/:id")
	async getUser(@Param("id") id: string) {
		return this.svc.getUser(Number(id));
	}

	@Put("users/:id")
	async updateUser(@Param("id") id: string, @Body() body: {
		name?: string; email?: string; plan?: string; role?: string; active?: number;
	}) {
		await this.svc.updateUser(Number(id), body);
		return { ok: true };
	}

	@Delete("users/:id")
	async deleteUser(@Param("id") id: string) {
		await this.svc.deleteUser(Number(id));
		return { ok: true };
	}
}
