PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_Asset` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`versionChainId` text NOT NULL,
	`name` text NOT NULL,
	`sourceLanguageId` text NOT NULL,
	`text` text,
	`images` text,
	`audio` text
);
--> statement-breakpoint
INSERT INTO `__new_Asset`("id", "rev", "createdAt", "lastUpdated", "versionChainId", "name", "sourceLanguageId", "text", "images", "audio") SELECT "id", "rev", "createdAt", "lastUpdated", "versionChainId", "name", "sourceLanguageId", "text", "images", "audio" FROM `Asset`;--> statement-breakpoint
DROP TABLE `Asset`;--> statement-breakpoint
ALTER TABLE `__new_Asset` RENAME TO `Asset`;--> statement-breakpoint
PRAGMA foreign_keys=ON;