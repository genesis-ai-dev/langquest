CREATE TABLE `Asset` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`versionChainId` text NOT NULL,
	`name` text NOT NULL,
	`sourceLanguageId` text NOT NULL,
	`text` text NOT NULL,
	`images` blob,
	`audio` blob
);
--> statement-breakpoint
CREATE TABLE `AssetToTags` (
	`asset_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`asset_id`, `tag_id`),
	FOREIGN KEY (`asset_id`) REFERENCES `Asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `Tag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `QuestToAssets` (
	`quest_id` text NOT NULL,
	`asset_id` text NOT NULL,
	PRIMARY KEY(`quest_id`, `asset_id`),
	FOREIGN KEY (`quest_id`) REFERENCES `Quest`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `Asset`(`id`) ON UPDATE no action ON DELETE no action
);
