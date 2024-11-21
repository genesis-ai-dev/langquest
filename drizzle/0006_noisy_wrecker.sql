CREATE TABLE `Quest` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`versionChainId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`projectId` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `QuestToTags` (
	`quest_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`quest_id`, `tag_id`),
	FOREIGN KEY (`quest_id`) REFERENCES `Quest`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `Tag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Tag` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`versionChainId` text NOT NULL,
	`name` text NOT NULL
);
