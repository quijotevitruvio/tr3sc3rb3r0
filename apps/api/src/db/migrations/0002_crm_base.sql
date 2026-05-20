CREATE TABLE `activities` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`actor_id` binary(16),
	`actor_kind` enum('user','system','ai') NOT NULL DEFAULT 'user',
	`entity_type` enum('contact','company','deal','task','note','pipeline') NOT NULL,
	`entity_id` binary(16) NOT NULL,
	`verb` varchar(50) NOT NULL,
	`payload` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`name` varchar(200) NOT NULL,
	`website` varchar(255),
	`industry` varchar(100),
	`size_bucket` enum('1-10','11-50','51-200','201-1000','1000+'),
	`country` char(2),
	`city` varchar(100),
	`notes_short` text,
	`custom` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`company_id` binary(16),
	`first_name` varchar(100) NOT NULL,
	`last_name` varchar(100),
	`email` varchar(255),
	`phone` varchar(30),
	`job_title` varchar(100),
	`source` varchar(80),
	`score` int NOT NULL DEFAULT 0,
	`custom` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_contacts_org_email` UNIQUE(`org_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`pipeline_id` binary(16) NOT NULL,
	`stage_id` binary(16) NOT NULL,
	`contact_id` binary(16),
	`company_id` binary(16),
	`assigned_to` binary(16),
	`title` varchar(200) NOT NULL,
	`amount` decimal(15,2) NOT NULL DEFAULT '0',
	`currency` char(3) NOT NULL DEFAULT 'COP',
	`status` enum('open','won','lost') NOT NULL DEFAULT 'open',
	`expected_close_date` date,
	`closed_at` datetime,
	`lost_reason` varchar(200),
	`custom` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `deals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`author_id` binary(16) NOT NULL,
	`entity_type` enum('contact','company','deal') NOT NULL,
	`entity_id` binary(16) NOT NULL,
	`body` text NOT NULL,
	`is_ai_generated` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pipelines` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`name` varchar(100) NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `pipelines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stages` (
	`id` binary(16) NOT NULL,
	`pipeline_id` binary(16) NOT NULL,
	`name` varchar(80) NOT NULL,
	`position` int NOT NULL,
	`win_probability` int NOT NULL DEFAULT 50,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`created_by` binary(16) NOT NULL,
	`assigned_to` binary(16),
	`entity_type` enum('contact','company','deal','none') NOT NULL DEFAULT 'none',
	`entity_id` binary(16),
	`title` varchar(200) NOT NULL,
	`description` text,
	`due_at` datetime,
	`status` enum('todo','done') NOT NULL DEFAULT 'todo',
	`completed_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_activities_org` ON `activities` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_activities_entity` ON `activities` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_activities_created` ON `activities` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_companies_org` ON `companies` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_companies_name` ON `companies` (`name`);--> statement-breakpoint
CREATE INDEX `idx_contacts_org` ON `contacts` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_contacts_company` ON `contacts` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_deals_org` ON `deals` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_deals_pipeline` ON `deals` (`pipeline_id`);--> statement-breakpoint
CREATE INDEX `idx_deals_stage` ON `deals` (`stage_id`);--> statement-breakpoint
CREATE INDEX `idx_deals_contact` ON `deals` (`contact_id`);--> statement-breakpoint
CREATE INDEX `idx_deals_assigned` ON `deals` (`assigned_to`);--> statement-breakpoint
CREATE INDEX `idx_deals_status` ON `deals` (`status`);--> statement-breakpoint
CREATE INDEX `idx_notes_org` ON `notes` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_notes_entity` ON `notes` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_pipelines_org` ON `pipelines` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_stages_pipeline` ON `stages` (`pipeline_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_org` ON `tasks` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_assigned` ON `tasks` (`assigned_to`);--> statement-breakpoint
CREATE INDEX `idx_tasks_due` ON `tasks` (`due_at`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);