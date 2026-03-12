import { Module } from "@nestjs/common";
import { CrmService } from "./crm.service";
import { CrmController } from "./crm.controller";
import { CrmEventsService } from "./crm-events.service";
import { WhatsappModule } from "~/whatsapp/whatsapp.module";

@Module({
	imports: [WhatsappModule],
	providers: [CrmService, CrmEventsService],
	controllers: [CrmController],
	exports: [CrmService, CrmEventsService],
})
export class CrmModule {}
