ALTER TABLE "helpdesk"."conversation" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "conversation_tags_idx" ON "helpdesk"."conversation" USING gin ("tags");