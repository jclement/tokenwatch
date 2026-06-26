ALTER TABLE `users` ADD `share_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_share_token_unique` ON `users` (`share_token`);