CREATE TABLE `channels` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`kind` enum('whatsapp','web','instagram','messenger','telegram') NOT NULL,
	`name` varchar(150) NOT NULL,
	`external_id` varchar(120),
	`config` json,
	`flow_json` json,
	`status` enum('active','paused') NOT NULL DEFAULT 'active',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `channels_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_channels_kind_external` UNIQUE(`org_id`,`kind`,`external_id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`channel_id` binary(16) NOT NULL,
	`contact_id` binary(16),
	`external_id` varchar(120) NOT NULL,
	`display_name` varchar(150),
	`status` enum('bot','open','pending','closed') NOT NULL DEFAULT 'bot',
	`assigned_to` binary(16),
	`bot_state` json,
	`unread` int NOT NULL DEFAULT 0,
	`last_message_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`closed_at` datetime,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`conversation_id` binary(16) NOT NULL,
	`direction` enum('in','out') NOT NULL,
	`sender_kind` enum('contact','bot','agent','system') NOT NULL,
	`sender_id` binary(16),
	`wa_message_id` varchar(128),
	`type` enum('text','image','audio','video','document','interactive','template','location','system') NOT NULL DEFAULT 'text',
	`body` text,
	`payload` json,
	`status` enum('received','sent','delivered','read','failed') NOT NULL DEFAULT 'received',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_messages_wa_id` UNIQUE(`wa_message_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_channels_org` ON `channels` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_conversations_org` ON `conversations` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_conversations_channel_ext` ON `conversations` (`channel_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_conversations_status` ON `conversations` (`org_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_conversations_assigned` ON `conversations` (`assigned_to`);--> statement-breakpoint
CREATE INDEX `idx_messages_conversation` ON `messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_org` ON `messages` (`org_id`);