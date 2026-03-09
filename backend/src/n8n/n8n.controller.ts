import { Controller, Post, Get, Delete, Patch, Body, Param, Req, UseGuards } from "@nestjs/common";
import { N8nService } from "./n8n.service";
import { JwtAuthGuard } from "~/auth/jwt-auth.guard";

@Controller("automations")
@UseGuards(JwtAuthGuard)
export class N8nController {
	constructor(private readonly n8nService: N8nService) {}

	// Cria workflow N8N + conecta webhook Evolution automaticamente
	@Post("create")
	async create(
		@Req() req,
		@Body() body: { instanceId: number; instanceName: string; name: string },
	) {
		// 1. Cria workflow no N8N
		const result = await this.n8nService.createWorkflow(
			req.user.id,
			body.instanceId,
			body.instanceName,
			body.name,
		);

		// 2. Conecta webhook da Evolution ao N8N automaticamente
		await this.n8nService.connectEvolutionWebhook(
			body.instanceName,
			result.webhookUrl,
		);

		return result;
	}

	@Get()
	async list(@Req() req) {
		return this.n8nService.listByUser(req.user.id);
	}

	@Patch(":id/toggle")
	async toggle(@Param("id") id: string, @Body() body: { active: boolean }) {
		return this.n8nService.toggleAutomation(Number(id), body.active);
	}

	@Delete(":id")
	async remove(@Param("id") id: string) {
		return this.n8nService.deleteAutomation(Number(id));
	}
}
