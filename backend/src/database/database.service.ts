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
				type ENUM('scheduled_message','group_fetch','auto_reply','webhook_forward') DEFAULT 'scheduled_message',
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

		// CRM tables
		await pool.query(`
			CREATE TABLE IF NOT EXISTS contacts (
				id INT AUTO_INCREMENT PRIMARY KEY,
				user_id INT NOT NULL,
				instance_id INT DEFAULT NULL,
				name VARCHAR(255) DEFAULT NULL,
				phone VARCHAR(30) NOT NULL,
				email VARCHAR(255) DEFAULT NULL,
				notes TEXT DEFAULT NULL,
				tags VARCHAR(500) DEFAULT NULL,
				stage_id INT DEFAULT NULL,
				last_message_at TIMESTAMP NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				UNIQUE KEY uq_user_phone (user_id, phone)
			)
		`);

		await pool.query(`
			CREATE TABLE IF NOT EXISTS crm_stages (
				id INT AUTO_INCREMENT PRIMARY KEY,
				user_id INT NOT NULL,
				name VARCHAR(255) NOT NULL,
				color VARCHAR(20) DEFAULT '#0a6fbe',
				position INT DEFAULT 0,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			)
		`);

		await pool.query(`
			CREATE TABLE IF NOT EXISTS contact_messages (
				id INT AUTO_INCREMENT PRIMARY KEY,
				contact_id INT NOT NULL,
				user_id INT NOT NULL,
				direction ENUM('incoming','outgoing') DEFAULT 'incoming',
				message_text TEXT DEFAULT NULL,
				message_type VARCHAR(50) DEFAULT 'text',
				remote_jid VARCHAR(255) DEFAULT NULL,
				instance_name VARCHAR(255) DEFAULT NULL,
				raw_data JSON DEFAULT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			)
		`);

		// Migrations
		await pool.query(`
			ALTER TABLE automations MODIFY COLUMN type ENUM('scheduled_message','group_fetch','auto_reply','webhook_forward') DEFAULT 'scheduled_message'
		`).catch(() => {});

		// Add last_read_at column to contacts for unread count tracking
		await pool.query(`
			ALTER TABLE contacts ADD COLUMN last_read_at TIMESTAMP NULL AFTER last_message_at
		`).catch(() => {});

		await pool.query(`
			CREATE TABLE IF NOT EXISTS push_subscriptions (
				id INT AUTO_INCREMENT PRIMARY KEY,
				user_id INT NOT NULL,
				endpoint VARCHAR(500) NOT NULL,
				subscription_json TEXT NOT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				UNIQUE KEY uq_user_endpoint (user_id, endpoint)
			)
		`);

		// Add role column to users
		await pool.query(`
			ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' AFTER plan
		`).catch(() => {});

		// Add is_group column to contacts
		await pool.query(`
			ALTER TABLE contacts ADD COLUMN is_group TINYINT(1) DEFAULT 0 AFTER phone
		`).catch(() => {});

		// Add profile_pic_url column to contacts
		await pool.query(`
			ALTER TABLE contacts ADD COLUMN profile_pic_url VARCHAR(500) DEFAULT NULL AFTER is_group
		`).catch(() => {});

		// Add display_name to instances (instance_name stays as Evolution API name)
		await pool.query(`
			ALTER TABLE whatsapp_instances ADD COLUMN display_name VARCHAR(255) DEFAULT NULL AFTER instance_name
		`).catch(() => {});


		// Ensure unique key is (user_id, phone, instance_id) so groups from different instances are separate
		// Drop old keys if they exist, then create the correct one
		await pool.query(`ALTER TABLE contacts DROP INDEX uq_user_phone`).catch(() => {});
		await pool.query(`ALTER TABLE contacts DROP INDEX uq_user_phone_instance`).catch(() => {});
		await pool.query(`
			ALTER TABLE contacts ADD UNIQUE KEY uq_user_phone_instance (user_id, phone, instance_id)
		`).catch(() => {});

		// Clean up duplicate contacts (non-group) that may have been created - keep the one with latest message
		await pool.query(`
			DELETE c1 FROM contacts c1
			INNER JOIN contacts c2
			ON c1.user_id = c2.user_id AND c1.phone = c2.phone AND c1.is_group = 0 AND c2.is_group = 0
			AND c1.id > c2.id
			WHERE c1.instance_id != c2.instance_id
		`).catch(() => {});

		// Quick replies table
		await pool.query(`
			CREATE TABLE IF NOT EXISTS quick_replies (
				id INT AUTO_INCREMENT PRIMARY KEY,
				user_id INT NOT NULL,
				title VARCHAR(100) NOT NULL,
				message TEXT NOT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			)
		`);

		this.logger.log("Tables verified.");
	}
}
