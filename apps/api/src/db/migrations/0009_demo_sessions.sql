CREATE TABLE `demo_sessions` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`user_id` binary(16) NOT NULL,
	`ip_hash` char(64) NOT NULL,
	`user_agent` varchar(255),
	`fingerprint` varchar(128),
	`consented_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`consent_text` text NOT NULL,
	`contact_email` varchar(255),
	`contact_name` varchar(150),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`expires_at` datetime NOT NULL,
	`deleted_at` datetime,
	CONSTRAINT `demo_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_demo_sessions_fingerprint` ON `demo_sessions` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `idx_demo_sessions_ip` ON `demo_sessions` (`ip_hash`);--> statement-breakpoint
CREATE INDEX `idx_demo_sessions_expires` ON `demo_sessions` (`expires_at`);