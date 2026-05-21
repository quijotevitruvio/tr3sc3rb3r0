CREATE TABLE `ia_usage` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`user_id` binary(16) NOT NULL,
	`feature` varchar(60) NOT NULL,
	`model` varchar(80) NOT NULL,
	`input_tokens` int NOT NULL,
	`output_tokens` int NOT NULL,
	`cost_micros_usd` int NOT NULL DEFAULT 0,
	`entity_type` varchar(20),
	`entity_id` binary(16),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ia_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_ia_usage_org` ON `ia_usage` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_ia_usage_user` ON `ia_usage` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_ia_usage_created` ON `ia_usage` (`created_at`);