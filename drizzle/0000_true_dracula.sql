CREATE TABLE `Asset` (
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
CREATE TABLE `AssetToTags` (
	`assetId` text NOT NULL,
	`tagId` text NOT NULL,
	PRIMARY KEY(`assetId`, `tagId`),
	FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Language` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`versionChainId` text NOT NULL,
	`nativeName` text,
	`englishName` text,
	`iso639_3` text,
	`uiReady` integer NOT NULL,
	`creatorId` text
);
--> statement-breakpoint
CREATE TABLE `Project` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`versionChainId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sourceLanguageId` text NOT NULL,
	`targetLanguageId` text NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE `QuestToAssets` (
	`questId` text NOT NULL,
	`assetId` text NOT NULL,
	PRIMARY KEY(`questId`, `assetId`),
	FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `QuestToTags` (
	`questId` text NOT NULL,
	`tagId` text NOT NULL,
	PRIMARY KEY(`questId`, `tagId`),
	FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON UPDATE no action ON DELETE no action
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
--> statement-breakpoint
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
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`versionChainId` text NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`uiLanguageId` text NOT NULL
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
