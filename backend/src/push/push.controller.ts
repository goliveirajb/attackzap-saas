import { Controller, Get, Post, Delete, Body, Req, UseGuards } from "@nestjs/common";
import { PushService } from "./push.service";
import { JwtAuthGuard } from "~/auth/jwt-auth.guard";

@Controller("push")
export class PushController {
	constructor(private readonly push: PushService) {}

	@Get("vapid-key")
	getVapidKey() {
		return { publicKey: this.push.getPublicKey() };
	}

	@Post("subscribe")
	@UseGuards(JwtAuthGuard)
	async subscribe(@Req() req, @Body() body: { subscription: any }) {
		await this.push.saveSubscription(req.user.id, body.subscription);
		return { ok: true };
	}

	@Delete("subscribe")
	@UseGuards(JwtAuthGuard)
	async unsubscribe(@Req() req, @Body() body: { endpoint: string }) {
		await this.push.removeSubscription(req.user.id, body.endpoint);
		return { ok: true };
	}
}
