CREATE SCHEMA IF NOT EXISTS "helpdesk";
--> statement-breakpoint
CREATE SEQUENCE "helpdesk"."reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000 CACHE 1;--> statement-breakpoint
CREATE TABLE "helpdesk"."activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"contact_id" uuid,
	"company_id" uuid,
	"deal_id" uuid,
	"agent_id" uuid,
	"body" text,
	"event" text,
	"props" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk"."agent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_user_id" text NOT NULL,
	"name" text,
	"email" text,
	"avatar_url" text,
	"away_until" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk"."attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk"."canned_reply" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"locale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk"."company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"external_org_id" text,
	"domain" text,
	"lead_stage" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk"."contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"company_id" uuid,
	"lead_stage" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"locale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "helpdesk"."conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer DEFAULT nextval('helpdesk.reference_seq') NOT NULL,
	"inbox" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"subject" text,
	"title" text,
	"contact_id" uuid NOT NULL,
	"company_id" uuid,
	"shared_with_company" boolean DEFAULT false NOT NULL,
	"assignee_id" uuid,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_suggestion" jsonb,
	"waiting_since" timestamp with time zone,
	"reminded_at" timestamp with time zone,
	"customer_seen_at" timestamp with time zone,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(subject, ''))) STORED
);
--> statement-breakpoint
CREATE TABLE "helpdesk"."deal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"company_id" uuid,
	"contact_id" uuid,
	"stage" text NOT NULL,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"value" numeric(14, 2),
	"currency" text DEFAULT 'CHF' NOT NULL,
	"expected_close_at" timestamp with time zone,
	"owner_id" uuid,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk"."identity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"external_id" text NOT NULL,
	"verified" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk"."job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk"."message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_type" text NOT NULL,
	"contact_id" uuid,
	"agent_id" uuid,
	"body" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"email_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', body)) STORED
);
--> statement-breakpoint
CREATE TABLE "helpdesk"."participant" (
	"conversation_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	CONSTRAINT "participant_conversation_id_contact_id_pk" PRIMARY KEY("conversation_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "helpdesk"."rate_limit" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "helpdesk"."setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "helpdesk"."activity" ADD CONSTRAINT "activity_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "helpdesk"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."activity" ADD CONSTRAINT "activity_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "helpdesk"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."activity" ADD CONSTRAINT "activity_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "helpdesk"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."activity" ADD CONSTRAINT "activity_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "helpdesk"."agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."attachment" ADD CONSTRAINT "attachment_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "helpdesk"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."attachment" ADD CONSTRAINT "attachment_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "helpdesk"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."contact" ADD CONSTRAINT "contact_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "helpdesk"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."conversation" ADD CONSTRAINT "conversation_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "helpdesk"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."conversation" ADD CONSTRAINT "conversation_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "helpdesk"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."conversation" ADD CONSTRAINT "conversation_assignee_id_agent_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "helpdesk"."agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."deal" ADD CONSTRAINT "deal_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "helpdesk"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."deal" ADD CONSTRAINT "deal_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "helpdesk"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."deal" ADD CONSTRAINT "deal_owner_id_agent_id_fk" FOREIGN KEY ("owner_id") REFERENCES "helpdesk"."agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."identity" ADD CONSTRAINT "identity_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "helpdesk"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "helpdesk"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."message" ADD CONSTRAINT "message_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "helpdesk"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."message" ADD CONSTRAINT "message_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "helpdesk"."agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."participant" ADD CONSTRAINT "participant_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "helpdesk"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk"."participant" ADD CONSTRAINT "participant_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "helpdesk"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_contact_idx" ON "helpdesk"."activity" USING btree ("contact_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activity_company_idx" ON "helpdesk"."activity" USING btree ("company_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activity_deal_idx" ON "helpdesk"."activity" USING btree ("deal_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_external_user_id_key" ON "helpdesk"."agent" USING btree ("external_user_id");--> statement-breakpoint
CREATE INDEX "attachment_conversation_idx" ON "helpdesk"."attachment" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_external_org_id_key" ON "helpdesk"."company" USING btree ("external_org_id");--> statement-breakpoint
CREATE INDEX "company_domain_idx" ON "helpdesk"."company" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "contact_company_idx" ON "helpdesk"."contact" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contact_email_idx" ON "helpdesk"."contact" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_number_key" ON "helpdesk"."conversation" USING btree ("number");--> statement-breakpoint
CREATE INDEX "conversation_inbox_status_idx" ON "helpdesk"."conversation" USING btree ("inbox","status");--> statement-breakpoint
CREATE INDEX "conversation_contact_idx" ON "helpdesk"."conversation" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE INDEX "conversation_company_idx" ON "helpdesk"."conversation" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "conversation_waiting_idx" ON "helpdesk"."conversation" USING btree ("waiting_since");--> statement-breakpoint
CREATE INDEX "conversation_search_idx" ON "helpdesk"."conversation" USING gin ("search");--> statement-breakpoint
CREATE INDEX "deal_stage_idx" ON "helpdesk"."deal" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "deal_company_idx" ON "helpdesk"."deal" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "deal_contact_idx" ON "helpdesk"."deal" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_verified_key" ON "helpdesk"."identity" USING btree ("channel","external_id") WHERE "helpdesk"."identity"."verified";--> statement-breakpoint
CREATE UNIQUE INDEX "identity_contact_key" ON "helpdesk"."identity" USING btree ("contact_id","channel","external_id");--> statement-breakpoint
CREATE INDEX "job_run_at_idx" ON "helpdesk"."job" USING btree ("run_at");--> statement-breakpoint
CREATE INDEX "message_conversation_idx" ON "helpdesk"."message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "message_contact_idx" ON "helpdesk"."message" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_email_message_id_key" ON "helpdesk"."message" USING btree ("email_message_id");--> statement-breakpoint
CREATE INDEX "message_search_idx" ON "helpdesk"."message" USING gin ("search");