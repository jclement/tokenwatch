CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`user_id` text,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text,
	`device_type` text,
	`backed_up` integer DEFAULT 0 NOT NULL,
	`name` text,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cred_user_idx` ON `credentials` (`user_id`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`name` text,
	`platform` text,
	`arch` text,
	`agent_version` text,
	`created_at` integer NOT NULL,
	`last_seen_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dev_user_idx` ON `devices` (`user_id`);--> statement-breakpoint
CREATE INDEX `dev_token_idx` ON `devices` (`token_hash`);--> statement-breakpoint
CREATE TABLE `events` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`day` integer NOT NULL,
	`ts` integer DEFAULT 0 NOT NULL,
	`hour` integer DEFAULT -1 NOT NULL,
	`session` text DEFAULT '' NOT NULL,
	`engine` text NOT NULL,
	`model` text NOT NULL,
	`input` integer NOT NULL,
	`cache_read` integer NOT NULL,
	`cache_create` integer NOT NULL,
	`output` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ev_user_day_idx` ON `events` (`user_id`,`day`);--> statement-breakpoint
CREATE INDEX `ev_user_session_idx` ON `events` (`user_id`,`session`);--> statement-breakpoint
CREATE INDEX `ev_user_hour_idx` ON `events` (`user_id`,`hour`);--> statement-breakpoint
CREATE TABLE `group_members` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gm_user_idx` ON `group_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`owner_id` text NOT NULL,
	`invite_code` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_slug_unique` ON `groups` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `groups_invite_code_unique` ON `groups` (`invite_code`);--> statement-breakpoint
CREATE TABLE `pairing_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`claimed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sess_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `text_stats` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`day` integer NOT NULL,
	`swears` integer NOT NULL,
	`polite` integer NOT NULL,
	`agreed` integer NOT NULL,
	`sorry` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ts_user_day_idx` ON `text_stats` (`user_id`,`day`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`avatar_key` text,
	`created_at` integer NOT NULL,
	`agent_version` text,
	`last_ingest_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `word_hits` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`word` text NOT NULL,
	`n` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`, `word`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
