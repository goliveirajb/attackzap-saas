import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";
import { AutomationsModule } from "./automations/automations.module";
import { N8nModule } from "./n8n/n8n.module";
import { CrmModule } from "./crm/crm.module";
import { AdminModule } from "./admin/admin.module";
import { PushModule } from "./push/push.module";

@Module({
	imports: [
		ScheduleModule.forRoot(),
		DatabaseModule,
		AuthModule,
		UsersModule,
		WhatsappModule,
		AutomationsModule,
		N8nModule,
		CrmModule,
		AdminModule,
		PushModule,
	],
})
export class AppModule {}
