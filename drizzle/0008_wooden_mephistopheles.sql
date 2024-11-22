CREATE TABLE `Translation` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`versionChainId` text NOT NULL,
	`assetId` text NOT NULL,
	`targetLanguageId` text NOT NULL,
	`text` text NOT NULL,
	`audio` text,
	`creatorId` text NOT NULL,
	FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`targetLanguageId`) REFERENCES `Language`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Vote` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`versionChainId` text NOT NULL,
	`translationId` text NOT NULL,
	`polarity` text NOT NULL,
	`comment` text,
	`creatorId` text NOT NULL,
	FOREIGN KEY (`translationId`) REFERENCES `Translation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_AssetToTags` (
	`assetId` text NOT NULL,
	`tagId` text NOT NULL,
	PRIMARY KEY(`assetId`, `tagId`),
	FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_AssetToTags`("assetId", "tagId") SELECT "assetId", "tagId" FROM `AssetToTags`;--> statement-breakpoint
DROP TABLE `AssetToTags`;--> statement-breakpoint
ALTER TABLE `__new_AssetToTags` RENAME TO `AssetToTags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_QuestToAssets` (
	`questId` text NOT NULL,
	`assetId` text NOT NULL,
	PRIMARY KEY(`questId`, `assetId`),
	FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_QuestToAssets`("questId", "assetId") SELECT "questId", "assetId" FROM `QuestToAssets`;--> statement-breakpoint
DROP TABLE `QuestToAssets`;--> statement-breakpoint
ALTER TABLE `__new_QuestToAssets` RENAME TO `QuestToAssets`;--> statement-breakpoint
CREATE TABLE `__new_QuestToTags` (
	`questId` text NOT NULL,
	`tagId` text NOT NULL,
	PRIMARY KEY(`questId`, `tagId`),
	FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_QuestToTags`("questId", "tagId") SELECT "questId", "tagId" FROM `QuestToTags`;--> statement-breakpoint
DROP TABLE `QuestToTags`;--> statement-breakpoint
ALTER TABLE `__new_QuestToTags` RENAME TO `QuestToTags`;--> statement-breakpoint
CREATE TABLE `__new_Asset` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`versionChainId` text NOT NULL,
	`name` text NOT NULL,
	`sourceLanguageId` text NOT NULL,
	`text` text NOT NULL,
	`images` text,
	`audio` text
);
--> statement-breakpoint
INSERT INTO `__new_Asset`("id", "rev", "createdAt", "lastUpdated", "versionChainId", "name", "sourceLanguageId", "text", "images", "audio") SELECT "id", "rev", "createdAt", "lastUpdated", "versionChainId", "name", "sourceLanguageId", "text", "images", "audio" FROM `Asset`;--> statement-breakpoint
DROP TABLE `Asset`;--> statement-breakpoint
ALTER TABLE `__new_Asset` RENAME TO `Asset`;