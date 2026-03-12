import { Module } from "@nestjs/common";
import { CrmService } from "./crm.service";
import { CrmController } from "./crm.controller";
import { WhatsappModule } from "~/whatsapp/whatsapp.module";

@Module({
	imports: [WhatsappModule],
	providers: [CrmService],
	controllers: [CrmController],
	exports: [CrmService],
})
export class CrmModule {}
