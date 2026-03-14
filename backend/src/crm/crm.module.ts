import { Module } from "@nestjs/common";
import { CrmService } from "./crm.service";
import { CrmController } from "./crm.controller";
import { CrmEventsService } from "./crm-events.service";
import { AiService } from "./ai.service";
import { WhatsappModule } from "~/whatsapp/whatsapp.module";
import { PushModule } from "~/push/push.module";

@Module({
	imports: [WhatsappModule, PushModule],
	providers: [CrmService, CrmEventsService, AiService],
	controllers: [CrmController],
	exports: [CrmService, CrmEventsService, AiService],
})
export class CrmModule {}
