ALTER TABLE "helpdesk"."agent" ADD COLUMN "viewing_id" uuid;--> statement-breakpoint
ALTER TABLE "helpdesk"."agent" ADD COLUMN "viewing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "helpdesk"."agent" ADD CONSTRAINT "agent_viewing_id_conversation_id_fk" FOREIGN KEY ("viewing_id") REFERENCES "helpdesk"."conversation"("id") ON DELETE set null ON UPDATE no action;