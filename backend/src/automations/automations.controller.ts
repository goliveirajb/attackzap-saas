import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards } from "@nestjs/common";
import { AutomationsService } from "./automations.service";
import { JwtAuthGuard } from "~/auth/jwt-auth.guard";

@Controller("scheduled-messages")
@UseGuards(JwtAuthGuard)
export class AutomationsController {
	constructor(private readonly automationsService: AutomationsService) {}

	@Post()
	async create(
		@Req() req,
		@Body()
		body: {
			automationId: number;
			horario: string;
			messageText: string;
			targetNumbers: string;
			diasSemana?: string;
		},
	) {
		return this.automationsService.createScheduledMessage(
			req.user.id,
			body.automationId,
			body.horario,
			body.messageText,
			body.targetNumbers,
			body.diasSemana,
		);
	}

	@Get()
	async list(@Req() req) {
		return this.automationsService.listByUser(req.user.id);
	}

	@Delete(":id")
	async remove(@Param("id") id: string) {
		return this.automationsService.deleteMessage(Number(id));
	}
}
