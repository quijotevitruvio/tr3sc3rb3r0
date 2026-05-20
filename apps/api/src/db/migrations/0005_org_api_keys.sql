CREATE TABLE `org_api_keys` (
	`org_id` binary(16) NOT NULL,
	`provider` enum('anthropic','openai','gemini') NOT NULL,
	`key_ciphertext` varchar(500) NOT NULL,
	`key_hint` varchar(16),
	`priority` int NOT NULL DEFAULT 0,
	`set_by` binary(16) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `org_api_keys_org_id_provider_pk` PRIMARY KEY(`org_id`,`provider`)
);
