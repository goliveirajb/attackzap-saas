import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import * as bodyParser from "body-parser";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Aumentar limite para upload de imagens base64
	app.use(bodyParser.json({ limit: "50mb" }));
	app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

	app.enableCors({
		origin: "*",
		methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
		credentials: true,
	});

	app.setGlobalPrefix("api");

	const port = process.env.PORT || 3000;
	await app.listen(port);
	console.log(`AttackZap SaaS running on port ${port}`);
}

bootstrap();
