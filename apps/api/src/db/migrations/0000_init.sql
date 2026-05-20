CREATE TABLE `email_verifications` (
	`id` binary(16) NOT NULL,
	`user_id` binary(16) NOT NULL,
	`code_hash` char(64) NOT NULL,
	`expires_at` datetime NOT NULL,
	`consumed_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `email_verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_members` (
	`org_id` binary(16) NOT NULL,
	`user_id` binary(16) NOT NULL,
	`role` enum('admin_org','user_org') NOT NULL DEFAULT 'admin_org',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `org_members_org_id_user_id_pk` PRIMARY KEY(`org_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` binary(16) NOT NULL,
	`name` varchar(150) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`tier` enum('free','pro','enterprise') NOT NULL DEFAULT 'free',
	`tier_expires_at` datetime,
	`demo_only` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` binary(16) NOT NULL,
	`user_id` binary(16) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`expires_at` datetime NOT NULL,
	`consumed_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `password_resets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` char(64) NOT NULL,
	`user_id` binary(16) NOT NULL,
	`expires_at` datetime NOT NULL,
	`ip_hash` char(64),
	`user_agent` varchar(255),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` binary(16) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`email_verified_at` datetime,
	`display_name` varchar(100),
	`is_superadmin` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `idx_email_verif_user` ON `email_verifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_org_members_user` ON `org_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);