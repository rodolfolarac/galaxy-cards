ALTER TABLE "cards" ADD COLUMN "retired" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "cards_retired_idx" ON "cards" USING btree ("retired");