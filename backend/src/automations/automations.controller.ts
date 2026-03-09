import { Controller, Post, Get, Put, Delete, Body, Param, Req, UseGuards } from "@nestjs/common";
import { AutomationsService } from "./automations.service";
import { JwtAuthGuard } from "~/auth/jwt-auth.guard";

@Controller("scheduled-messages")
@UseGuards(JwtAuthGuard)
export class AutomationsController {
	constructor(private readonly svc: AutomationsService) {}

	@Get()
	async list(@Req() req) {
		return this.svc.listarMensagens(req.user.id);
	}

	@Post()
	async create(
		@Req() req,
		@Body() body: {
			automationId: number;
			horario: string;
			messageText: string;
			targetNumbers: string;
			diasSemana?: string;
		},
	) {
		return this.svc.criarMensagem(
			req.user.id,
			body.automationId,
			body.horario,
			body.messageText,
			body.targetNumbers,
			body.diasSemana,
		);
	}

	@Put(":id")
	async update(
		@Param("id") id: string,
		@Body() body: {
			horario?: string;
			message_text?: string;
			target_numbers?: string;
			dias_semana?: string;
			active?: number;
		},
	) {
		return this.svc.atualizarMensagem(Number(id), body);
	}

	@Delete(":id")
	async remove(@Param("id") id: string) {
		return this.svc.deletarMensagem(Number(id));
	}

	@Post(":id/upload")
	async upload(
		@Param("id") id: string,
		@Body() body: { base64: string; filename: string },
	) {
		const ext = body.filename?.split(".").pop()?.toLowerCase() || "png";
		const mimeMap = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
		const mime = mimeMap[ext] || "image/png";

		const base64Data = body.base64.startsWith("data:") ? body.base64 : `data:${mime};base64,${body.base64}`;
		return this.svc.salvarImagem(Number(id), base64Data);
	}

	@Delete(":id/image")
	async removeImage(@Param("id") id: string) {
		return this.svc.removerImagem(Number(id));
	}
}
