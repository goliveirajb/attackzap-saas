import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query, Sse } from "@nestjs/common";
import { CrmService } from "./crm.service";
import { CrmEventsService } from "./crm-events.service";
import { JwtAuthGuard } from "~/auth/jwt-auth.guard";

@Controller("crm")
export class CrmController {
	constructor(
		private readonly svc: CrmService,
		private readonly events: CrmEventsService,
	) {}

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

	// ==================== QUICK REPLIES ====================

	@Get("quick-replies")
	@UseGuards(JwtAuthGuard)
	async getQuickReplies(@Req() req) {
		return this.svc.getQuickReplies(req.user.id);
	}

	@Post("quick-replies")
	@UseGuards(JwtAuthGuard)
	async createQuickReply(@Req() req, @Body() body: { title: string; message: string }) {
		return this.svc.createQuickReply(req.user.id, body.title, body.message);
	}

	@Delete("quick-replies/:id")
	@UseGuards(JwtAuthGuard)
	async deleteQuickReply(@Req() req, @Param("id") id: string) {
		return this.svc.deleteQuickReply(Number(id), req.user.id);
	}

	// ==================== PROFILE PICTURE ====================

	@Get("contacts/:id/profile-pic")
	@UseGuards(JwtAuthGuard)
	async getProfilePic(@Req() req, @Param("id") id: string) {
		const url = await this.svc.fetchProfilePic(Number(id), req.user.id);
		return { url };
	}

	// ==================== READ STATUS ====================

	@Put("contacts/:id/read")
	@UseGuards(JwtAuthGuard)
	async markAsRead(@Req() req, @Param("id") id: string) {
		return this.svc.markAsRead(req.user.id, Number(id));
	}

	// ==================== MESSAGES ====================

	@Get("contacts/:id/messages")
	@UseGuards(JwtAuthGuard)
	async getMessages(@Param("id") id: string, @Query("limit") limit?: string) {
		return this.svc.getMessages(Number(id), Number(limit) || 50);
	}

	@Get("messages/:id/media")
	@UseGuards(JwtAuthGuard)
	async getMessageMedia(@Req() req, @Param("id") id: string) {
		const media = await this.svc.getMessageMedia(Number(id), req.user.id);
		if (!media) return { error: "Media not found" };
		return media;
	}

	@Post("contacts/:id/send")
	@UseGuards(JwtAuthGuard)
	async sendMessage(@Req() req, @Param("id") id: string, @Body() body: { text: string }) {
		return this.svc.sendMessage(req.user.id, Number(id), body.text);
	}

	@Post("contacts/:id/send-media")
	@UseGuards(JwtAuthGuard)
	async sendMedia(@Req() req, @Param("id") id: string, @Body() body: { base64: string; caption?: string; mediaType?: string }) {
		return this.svc.sendMedia(req.user.id, Number(id), body.base64, body.caption || "", body.mediaType || "image");
	}

	// ==================== SSE (real-time events) ====================

	@Sse("events")
	@UseGuards(JwtAuthGuard)
	sseEvents(@Req() req) {
		return this.events.subscribe(req.user.id);
	}

	// ==================== WEBHOOK (public - called by Evolution) ====================

	// Test endpoint - access GET /api/crm/webhook to verify route is reachable
	@Get("webhook")
	webhookTest() {
		return { ok: true, message: "CRM webhook endpoint is reachable", timestamp: new Date().toISOString() };
	}

	@Post("webhook")
	async webhook(@Body() body: any) {
		console.log("[CRM WEBHOOK] Received:", JSON.stringify({
			event: body?.event,
			instance: body?.instance,
			remoteJid: body?.data?.key?.remoteJid,
			fromMe: body?.data?.key?.fromMe,
			hasData: !!body?.data,
		}));
		return this.svc.processIncomingMessage(body);
	}
}
