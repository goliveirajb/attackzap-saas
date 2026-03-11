import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query } from "@nestjs/common";
import { CrmService } from "./crm.service";
import { JwtAuthGuard } from "~/auth/jwt-auth.guard";

@Controller("crm")
export class CrmController {
	constructor(private readonly svc: CrmService) {}

	// ==================== STAGES ====================

	@Get("stages")
	@UseGuards(JwtAuthGuard)
	async getStages(@Req() req) {
		return this.svc.getStages(req.user.id);
	}

	@Post("stages")
	@UseGuards(JwtAuthGuard)
	async createStage(@Req() req, @Body() body: { name: string; color?: string }) {
		return this.svc.createStage(req.user.id, body.name, body.color || "#0a6fbe");
	}

	@Put("stages/:id")
	@UseGuards(JwtAuthGuard)
	async updateStage(@Param("id") id: string, @Body() body: { name?: string; color?: string; position?: number }) {
		return this.svc.updateStage(Number(id), body);
	}

	@Delete("stages/:id")
	@UseGuards(JwtAuthGuard)
	async deleteStage(@Param("id") id: string) {
		return this.svc.deleteStage(Number(id));
	}

	// ==================== CONTACTS ====================

	@Get("contacts")
	@UseGuards(JwtAuthGuard)
	async getContacts(@Req() req) {
		return this.svc.getContacts(req.user.id);
	}

	@Get("contacts/:id")
	@UseGuards(JwtAuthGuard)
	async getContact(@Req() req, @Param("id") id: string) {
		return this.svc.getContact(req.user.id, Number(id));
	}

	@Post("contacts")
	@UseGuards(JwtAuthGuard)
	async createContact(@Req() req, @Body() body: {
		name?: string; phone: string; email?: string;
		notes?: string; tags?: string; stage_id?: number; instance_id?: number;
	}) {
		return this.svc.createContact(req.user.id, body);
	}

	@Put("contacts/:id")
	@UseGuards(JwtAuthGuard)
	async updateContact(@Param("id") id: string, @Body() body: {
		name?: string; phone?: string; email?: string;
		notes?: string; tags?: string; stage_id?: number | null;
	}) {
		return this.svc.updateContact(Number(id), body);
	}

	@Put("contacts/:id/move")
	@UseGuards(JwtAuthGuard)
	async moveContact(@Param("id") id: string, @Body() body: { stage_id: number | null }) {
		return this.svc.moveContact(Number(id), body.stage_id);
	}

	@Delete("contacts/:id")
	@UseGuards(JwtAuthGuard)
	async deleteContact(@Param("id") id: string) {
		return this.svc.deleteContact(Number(id));
	}

	// ==================== MESSAGES ====================

	@Get("contacts/:id/messages")
	@UseGuards(JwtAuthGuard)
	async getMessages(@Param("id") id: string, @Query("limit") limit?: string) {
		return this.svc.getMessages(Number(id), Number(limit) || 50);
	}

	// ==================== WEBHOOK (public - called by Evolution) ====================

	@Post("webhook")
	async webhook(@Body() body: any) {
		return this.svc.processIncomingMessage(body);
	}
}
