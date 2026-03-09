CREATE DATABASE IF NOT EXISTS attackzap_saas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON attackzap_saas.* TO 'localuser'@'%';
FLUSH PRIVILEGES;
