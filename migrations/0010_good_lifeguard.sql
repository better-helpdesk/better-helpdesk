ALTER TABLE "helpdesk"."conversation" ADD COLUMN "rating" text;--> statement-breakpoint
ALTER TABLE "helpdesk"."conversation" ADD COLUMN "rating_comment" text;--> statement-breakpoint
ALTER TABLE "helpdesk"."conversation" ADD COLUMN "rated_at" timestamp with time zone;