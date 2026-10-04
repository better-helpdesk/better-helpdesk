ALTER TABLE "helpdesk"."agent" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "helpdesk"."identity" ADD COLUMN "last_used_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "helpdesk"."message" ADD COLUMN "verified" boolean;