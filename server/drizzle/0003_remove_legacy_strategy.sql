PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`capability_config` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer,
	`completed_at` integer,
	`error_message` text,
	`input_tokens` integer DEFAULT 0,
	`output_tokens` integer DEFAULT 0,
	`total_tokens` integer DEFAULT 0,
	`cost` text DEFAULT '0',
	`duration_ms` integer DEFAULT 0,
	`step_count` integer DEFAULT 0
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "prompt", "capability_config", "status", "created_at", "updated_at", "completed_at", "error_message", "input_tokens", "output_tokens", "total_tokens", "cost", "duration_ms", "step_count")
SELECT "id", "prompt", COALESCE("capability_config", '{"inputMode":"naive"}'), "status", "created_at", "updated_at", "completed_at", "error_message", "input_tokens", "output_tokens", "total_tokens", "cost", "duration_ms", "step_count" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;