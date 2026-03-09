import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards } from "@nestjs/common";
import { WhatsappService } from "./whatsapp.service";
import { JwtAuthGuard } from "~/auth/jwt-auth.guard";

@Controller("whatsapp")
@UseGuards(JwtAuthGuard)
export class WhatsappController {
	constructor(private readonly whatsappService: WhatsappService) {}

	@Post("instances")
	async create(@Req() req, @Body() body: { instanceName: string }) {
		return this.whatsappService.createInstance(req.user.id, body.instanceName);
	}

	@Get("instances")
	async list(@Req() req) {
		return this.whatsappService.listByUser(req.user.id);
	}

	@Get("instances/:name/qrcode")
	async qrcode(@Param("name") name: string) {
		return this.whatsappService.getQrCode(name);
	}

	@Get("instances/:name/status")
	async status(@Param("name") name: string) {
		return this.whatsappService.getConnectionStatus(name);
	}

	@Post("instances/:name/webhook")
	async setWebhook(@Param("name") name: string, @Body() body: { url: string }) {
		return this.whatsappService.setWebhook(name, body.url);
	}

	@Post("instances/:name/send-text")
	async sendText(
		@Param("name") name: string,
		@Body() body: { number: string; text: string },
	) {
		return this.whatsappService.sendText(name, body.number, body.text);
	}

	@Delete("instances/:id/:name")
	async remove(@Param("id") id: string, @Param("name") name: string) {
		return this.whatsappService.deleteInstance(Number(id), name);
	}
}
