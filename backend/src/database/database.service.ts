import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import * as mysql from "mysql2/promise";

@Injectable()
export class DatabaseService implements OnModuleInit {
	private pool: mysql.Pool;
	private readonly logger = new Logger(DatabaseService.name);

	async onModuleInit() {
		this.pool = mysql.createPool({
			host: process.env.DB_HOST || "localhost",
			port: Number(process.env.DB_PORT) || 3306,
			user: process.env.DB_USERNAME || "root",
			password: process.env.DB_PASSWORD || "",
			database: process.env.DB_DATABASE || "attackzap_saas",
			waitForConnections: true,
			connectionLimit: 10,
		});

		try {
			const conn = await this.pool.getConnection();
			conn.release();
			this.logger.log("Database connected.");
		} catch (err) {
			this.logger.error("Database connection failed:", err.message);
		}

		await this.createTables();
	}

	getPool() {
		return this.pool;
	}

	private async createTables() {
		const pool = this.pool;

		await pool.query(`
			CREATE TABLE IF NOT EXISTS users (
				id INT AUTO_INCREMENT PRIMARY KEY,
				name VARCHAR(255) NOT NULL,
				email VARCHAR(255) UNIQUE NOT NULL,
				password VARCHAR(255) NOT NULL,
				plan VARCHAR(50) DEFAULT 'free',
				active TINYINT(1) DEFAULT 1,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
			)
		`);

		await pool.query(`
			CREATE TABLE IF NOT EXISTS whatsapp_instances (
				id INT AUTO_INCREMENT PRIMARY KEY,
				user_id INT NOT NULL,
				instance_name VARCHAR(255) NOT NULL,
				instance_key VARCHAR(255) DEFAULT NULL,
				status ENUM('disconnected','connecting','connected') DEFAULT 'disconnected',
				phone VARCHAR(30) DEFAULT NULL,
				qr_code LONGTEXT DEFAULT NULL,
				webhook_url VARCHAR(500) DEFAULT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			)
		`);

		await pool.query(`
			CREATE TABLE IF NOT EXISTS automations (
				id INT AUTO_INCREMENT PRIMARY KEY,
				user_id INT NOT NULL,
				instance_id INT NOT NULL,
				name VARCHAR(255) NOT NULL,
				type ENUM('scheduled_message','auto_reply','webhook_forward') DEFAULT 'scheduled_message',
				config JSON DEFAULT NULL,
				n8n_workflow_id VARCHAR(100) DEFAULT NULL,
				n8n_webhook_url VARCHAR(500) DEFAULT NULL,
				active TINYINT(1) DEFAULT 1,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				FOREIGN KEY (instance_id) REFERENCES whatsapp_instances(id) ON DELETE CASCADE
			)
		`);

		await pool.query(`
			CREATE TABLE IF NOT EXISTS scheduled_messages (
				id INT AUTO_INCREMENT PRIMARY KEY,
				automation_id INT NOT NULL,
				user_id INT NOT NULL,
				horario TIME NOT NULL,
				message_text TEXT DEFAULT NULL,
				media_base64 LONGTEXT DEFAULT NULL,
				target_numbers TEXT DEFAULT NULL,
				dias_semana VARCHAR(50) DEFAULT '0,1,2,3,4,5,6',
				active TINYINT(1) DEFAULT 1,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			)
		`);

		this.logger.log("Tables verified.");
	}
}
