DROP INDEX "helpdesk"."identity_contact_key";--> statement-breakpoint
CREATE INDEX "participant_contact_idx" ON "helpdesk"."participant" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_contact_key" ON "helpdesk"."identity" USING btree ("channel","external_id","contact_id");