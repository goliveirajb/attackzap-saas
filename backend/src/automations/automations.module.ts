import { Module } from "@nestjs/common";
import { AutomationsService } from "./automations.service";
import { AutomationsController } from "./automations.controller";
import { WhatsappModule } from "~/whatsapp/whatsapp.module";

@Module({
	imports: [WhatsappModule],
	providers: [AutomationsService],
	controllers: [AutomationsController],
	exports: [AutomationsService],
})
export class AutomationsModule {}
