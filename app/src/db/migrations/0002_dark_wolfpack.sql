ALTER TABLE `events` ADD `cache_create_1h` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Rewrite agent-local midnights as calendar-date keys (UTC midnight of the local
-- date). Idempotent: an existing key maps to itself. See dayKey in routes/ingest.ts.
UPDATE `events` SET `day` = ((`day` + 46800) / 86400) * 86400;--> statement-breakpoint
UPDATE `text_stats` SET `day` = ((`day` + 46800) / 86400) * 86400;
