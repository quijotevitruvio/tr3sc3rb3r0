CREATE TABLE `automations` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`name` varchar(150) NOT NULL,
	`description` varchar(500),
	`trigger` varchar(50) NOT NULL,
	`condition_json` json,
	`actions_json` json NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`runs_count` int NOT NULL DEFAULT 0,
	`last_run_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `automations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`name` varchar(150) NOT NULL,
	`subject` varchar(300) NOT NULL,
	`body` text NOT NULL,
	`category` enum('welcome','follow_up','proposal','reminder','custom') NOT NULL DEFAULT 'custom',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scoring_rules` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`name` varchar(150) NOT NULL,
	`trigger` varchar(50) NOT NULL,
	`delta` int NOT NULL,
	`condition_json` json,
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `scoring_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_automations_org` ON `automations` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_automations_trigger` ON `automations` (`trigger`);--> statement-breakpoint
CREATE INDEX `idx_email_templates_org` ON `email_templates` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_scoring_rules_org` ON `scoring_rules` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_scoring_rules_trigger` ON `scoring_rules` (`trigger`);