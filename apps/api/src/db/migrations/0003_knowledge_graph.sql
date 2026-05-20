CREATE TABLE `entity_links` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`from_type` enum('contact','company','deal') NOT NULL,
	`from_id` binary(16) NOT NULL,
	`to_type` enum('contact','company','deal') NOT NULL,
	`to_id` binary(16) NOT NULL,
	`relation_kind` enum('mentions','related_to','reports_to','partners_with','custom') NOT NULL DEFAULT 'related_to',
	`source` enum('note_parser','manual','ai') NOT NULL DEFAULT 'manual',
	`source_note_id` binary(16),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `entity_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_entity_links_dedup` UNIQUE(`org_id`,`from_type`,`from_id`,`to_type`,`to_id`,`relation_kind`)
);
--> statement-breakpoint
CREATE TABLE `entity_tags` (
	`org_id` binary(16) NOT NULL,
	`tag_id` binary(16) NOT NULL,
	`entity_type` enum('contact','company','deal') NOT NULL,
	`entity_id` binary(16) NOT NULL,
	`assigned_by` binary(16),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `entity_tags_org_id_tag_id_entity_type_entity_id_pk` PRIMARY KEY(`org_id`,`tag_id`,`entity_type`,`entity_id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`name` varchar(80) NOT NULL,
	`category` enum('interest','behavior','segment','custom') NOT NULL DEFAULT 'custom',
	`color` char(7) NOT NULL DEFAULT '#39ff14',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_tags_org_name` UNIQUE(`org_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `idx_entity_links_org` ON `entity_links` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_entity_links_from` ON `entity_links` (`from_type`,`from_id`);--> statement-breakpoint
CREATE INDEX `idx_entity_links_to` ON `entity_links` (`to_type`,`to_id`);--> statement-breakpoint
CREATE INDEX `idx_entity_tags_entity` ON `entity_tags` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_entity_tags_tag` ON `entity_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_tags_org` ON `tags` (`org_id`);