CREATE TYPE "public"."activity_actor_kind" AS ENUM('user', 'system', 'ai');--> statement-breakpoint
CREATE TYPE "public"."activity_entity_type" AS ENUM('contact', 'company', 'deal', 'task', 'note', 'pipeline');--> statement-breakpoint
CREATE TYPE "public"."channel_kind" AS ENUM('whatsapp', 'web', 'instagram', 'messenger', 'telegram');--> statement-breakpoint
CREATE TYPE "public"."channel_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."chat_message_role" AS ENUM('user', 'assistant', 'tool', 'system');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('bot', 'open', 'pending', 'closed');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."email_template_category" AS ENUM('welcome', 'follow_up', 'proposal', 'reminder', 'custom');--> statement-breakpoint
CREATE TYPE "public"."entity_link_from_type" AS ENUM('contact', 'company', 'deal');--> statement-breakpoint
CREATE TYPE "public"."entity_link_relation_kind" AS ENUM('mentions', 'related_to', 'reports_to', 'partners_with', 'custom');--> statement-breakpoint
CREATE TYPE "public"."entity_link_source" AS ENUM('note_parser', 'manual', 'ai');--> statement-breakpoint
CREATE TYPE "public"."entity_link_to_type" AS ENUM('contact', 'company', 'deal');--> statement-breakpoint
CREATE TYPE "public"."entity_tag_entity_type" AS ENUM('contact', 'company', 'deal');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."message_sender_kind" AS ENUM('contact', 'bot', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('received', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'image', 'audio', 'video', 'document', 'interactive', 'template', 'location', 'system');--> statement-breakpoint
CREATE TYPE "public"."note_entity_type" AS ENUM('contact', 'company', 'deal');--> statement-breakpoint
CREATE TYPE "public"."org_api_key_provider" AS ENUM('anthropic', 'openai', 'gemini', 'openrouter');--> statement-breakpoint
CREATE TYPE "public"."org_member_role" AS ENUM('admin_org', 'user_org');--> statement-breakpoint
CREATE TYPE "public"."size_bucket" AS ENUM('1-10', '11-50', '51-200', '201-1000', '1000+');--> statement-breakpoint
CREATE TYPE "public"."tag_category" AS ENUM('interest', 'behavior', 'segment', 'custom');--> statement-breakpoint
CREATE TYPE "public"."task_entity_type" AS ENUM('contact', 'company', 'deal', 'none');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'done');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('demo', 'basico', 'pro', 'max');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"actor_id" "bytea",
	"actor_kind" "activity_actor_kind" DEFAULT 'user' NOT NULL,
	"entity_type" "activity_entity_type" NOT NULL,
	"entity_id" "bytea" NOT NULL,
	"verb" varchar(50) NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" varchar(500),
	"trigger" varchar(50) NOT NULL,
	"condition_json" jsonb,
	"actions_json" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"runs_count" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"kind" "channel_kind" NOT NULL,
	"name" varchar(150) NOT NULL,
	"external_id" varchar(120),
	"config" jsonb,
	"flow_json" jsonb,
	"status" "channel_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"session_id" "bytea" NOT NULL,
	"org_id" "bytea" NOT NULL,
	"role" "chat_message_role" NOT NULL,
	"content" jsonb NOT NULL,
	"tool_name" varchar(80),
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"user_id" "bytea" NOT NULL,
	"title" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"name" varchar(200) NOT NULL,
	"website" varchar(255),
	"industry" varchar(100),
	"size_bucket" "size_bucket",
	"country" char(2),
	"city" varchar(100),
	"notes_short" text,
	"custom" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"company_id" "bytea",
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100),
	"email" varchar(255),
	"phone" varchar(30),
	"job_title" varchar(100),
	"source" varchar(80),
	"score" integer DEFAULT 0 NOT NULL,
	"custom" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"channel_id" "bytea" NOT NULL,
	"contact_id" "bytea",
	"external_id" varchar(120) NOT NULL,
	"display_name" varchar(150),
	"status" "conversation_status" DEFAULT 'bot' NOT NULL,
	"assigned_to" "bytea",
	"bot_state" jsonb,
	"unread" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"pipeline_id" "bytea" NOT NULL,
	"stage_id" "bytea" NOT NULL,
	"contact_id" "bytea",
	"company_id" "bytea",
	"assigned_to" "bytea",
	"title" varchar(200) NOT NULL,
	"amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" char(3) DEFAULT 'COP' NOT NULL,
	"status" "deal_status" DEFAULT 'open' NOT NULL,
	"expected_close_date" date,
	"closed_at" timestamp with time zone,
	"lost_reason" varchar(200),
	"custom" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "demo_sessions" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"user_id" "bytea" NOT NULL,
	"ip_hash" char(64) NOT NULL,
	"user_agent" varchar(255),
	"fingerprint" varchar(128),
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consent_text" text NOT NULL,
	"contact_email" varchar(255),
	"contact_name" varchar(150),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"name" varchar(150) NOT NULL,
	"subject" varchar(300) NOT NULL,
	"body" text NOT NULL,
	"category" "email_template_category" DEFAULT 'custom' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"user_id" "bytea" NOT NULL,
	"code_hash" char(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_links" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"from_type" "entity_link_from_type" NOT NULL,
	"from_id" "bytea" NOT NULL,
	"to_type" "entity_link_to_type" NOT NULL,
	"to_id" "bytea" NOT NULL,
	"relation_kind" "entity_link_relation_kind" DEFAULT 'related_to' NOT NULL,
	"source" "entity_link_source" DEFAULT 'manual' NOT NULL,
	"source_note_id" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_tags" (
	"org_id" "bytea" NOT NULL,
	"tag_id" "bytea" NOT NULL,
	"entity_type" "entity_tag_entity_type" NOT NULL,
	"entity_id" "bytea" NOT NULL,
	"assigned_by" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_tags_org_id_tag_id_entity_type_entity_id_pk" PRIMARY KEY("org_id","tag_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "ia_usage" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"user_id" "bytea" NOT NULL,
	"feature" varchar(60) NOT NULL,
	"model" varchar(80) NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_micros_usd" integer DEFAULT 0 NOT NULL,
	"entity_type" varchar(20),
	"entity_id" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"conversation_id" "bytea" NOT NULL,
	"direction" "message_direction" NOT NULL,
	"sender_kind" "message_sender_kind" NOT NULL,
	"sender_id" "bytea",
	"wa_message_id" varchar(128),
	"type" "message_type" DEFAULT 'text' NOT NULL,
	"body" text,
	"payload" jsonb,
	"status" "message_status" DEFAULT 'received' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"author_id" "bytea" NOT NULL,
	"entity_type" "note_entity_type" NOT NULL,
	"entity_id" "bytea" NOT NULL,
	"body" text NOT NULL,
	"is_ai_generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_api_keys" (
	"org_id" "bytea" NOT NULL,
	"provider" "org_api_key_provider" NOT NULL,
	"key_ciphertext" varchar(500) NOT NULL,
	"key_hint" varchar(16),
	"priority" integer DEFAULT 0 NOT NULL,
	"set_by" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_api_keys_org_id_provider_pk" PRIMARY KEY("org_id","provider")
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"org_id" "bytea" NOT NULL,
	"user_id" "bytea" NOT NULL,
	"role" "org_member_role" DEFAULT 'admin_org' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_members_org_id_user_id_pk" PRIMARY KEY("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"tier" "tier" DEFAULT 'basico' NOT NULL,
	"tier_expires_at" timestamp with time zone,
	"demo_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"user_id" "bytea" NOT NULL,
	"token_hash" char(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scoring_rules" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"name" varchar(150) NOT NULL,
	"trigger" varchar(50) NOT NULL,
	"delta" integer NOT NULL,
	"condition_json" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" char(64) PRIMARY KEY NOT NULL,
	"user_id" "bytea" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_hash" char(64),
	"user_agent" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"pipeline_id" "bytea" NOT NULL,
	"name" varchar(80) NOT NULL,
	"position" integer NOT NULL,
	"win_probability" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"name" varchar(80) NOT NULL,
	"category" "tag_category" DEFAULT 'custom' NOT NULL,
	"color" char(7) DEFAULT '#39ff14' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"org_id" "bytea" NOT NULL,
	"created_by" "bytea" NOT NULL,
	"assigned_to" "bytea",
	"entity_type" "task_entity_type" DEFAULT 'none' NOT NULL,
	"entity_id" "bytea",
	"title" varchar(200) NOT NULL,
	"description" text,
	"due_at" timestamp with time zone,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" "bytea" PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"email_verified_at" timestamp with time zone,
	"display_name" varchar(100),
	"is_superadmin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "idx_activities_org" ON "activities" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_activities_entity" ON "activities" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_activities_created" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_automations_org" ON "automations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_automations_trigger" ON "automations" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "idx_channels_org" ON "channels" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_channels_kind_external" ON "channels" USING btree ("org_id","kind","external_id");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_session" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_org" ON "chat_messages" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_chat_sessions_org" ON "chat_sessions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_chat_sessions_user" ON "chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chat_sessions_last" ON "chat_sessions" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "idx_companies_org" ON "companies" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_companies_name" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_contacts_org" ON "contacts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_company" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_contacts_org_email" ON "contacts" USING btree ("org_id","email");--> statement-breakpoint
CREATE INDEX "idx_conversations_org" ON "conversations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_channel_ext" ON "conversations" USING btree ("channel_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_status" ON "conversations" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "idx_conversations_assigned" ON "conversations" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_deals_org" ON "deals" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_deals_pipeline" ON "deals" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "idx_deals_stage" ON "deals" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "idx_deals_contact" ON "deals" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_deals_assigned" ON "deals" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_deals_status" ON "deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_demo_sessions_fingerprint" ON "demo_sessions" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "idx_demo_sessions_ip" ON "demo_sessions" USING btree ("ip_hash");--> statement-breakpoint
CREATE INDEX "idx_demo_sessions_expires" ON "demo_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_email_templates_org" ON "email_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_email_verif_user" ON "email_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_entity_links_org" ON "entity_links" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_entity_links_from" ON "entity_links" USING btree ("from_type","from_id");--> statement-breakpoint
CREATE INDEX "idx_entity_links_to" ON "entity_links" USING btree ("to_type","to_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_entity_links_dedup" ON "entity_links" USING btree ("org_id","from_type","from_id","to_type","to_id","relation_kind");--> statement-breakpoint
CREATE INDEX "idx_entity_tags_entity" ON "entity_tags" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_entity_tags_tag" ON "entity_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_ia_usage_org" ON "ia_usage" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_ia_usage_user" ON "ia_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ia_usage_created" ON "ia_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_messages_org" ON "messages" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_messages_wa_id" ON "messages" USING btree ("wa_message_id");--> statement-breakpoint
CREATE INDEX "idx_notes_org" ON "notes" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_notes_entity" ON "notes" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_org_members_user" ON "org_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pipelines_org" ON "pipelines" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_scoring_rules_org" ON "scoring_rules" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_scoring_rules_trigger" ON "scoring_rules" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_stages_pipeline" ON "stages" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "idx_tags_org" ON "tags" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tags_org_name" ON "tags" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "idx_tasks_org" ON "tasks" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_assigned" ON "tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_tasks_due" ON "tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_status" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");