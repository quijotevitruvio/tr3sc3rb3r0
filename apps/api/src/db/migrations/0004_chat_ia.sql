CREATE TABLE `chat_messages` (
	`id` binary(16) NOT NULL,
	`session_id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`role` enum('user','assistant','tool','system') NOT NULL,
	`content` json NOT NULL,
	`tool_name` varchar(80),
	`input_tokens` int NOT NULL DEFAULT 0,
	`output_tokens` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` binary(16) NOT NULL,
	`org_id` binary(16) NOT NULL,
	`user_id` binary(16) NOT NULL,
	`title` varchar(200),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`last_message_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `chat_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_chat_messages_session` ON `chat_messages` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_org` ON `chat_messages` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_org` ON `chat_sessions` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_user` ON `chat_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_last` ON `chat_sessions` (`last_message_at`);