ALTER TABLE `Asset` RENAME TO `asset`;--> statement-breakpoint
ALTER TABLE `AssetToTags` RENAME TO `asset_tag_link`;--> statement-breakpoint
ALTER TABLE `Language` RENAME TO `language`;--> statement-breakpoint
ALTER TABLE `User` RENAME TO `profile`;--> statement-breakpoint
ALTER TABLE `Project` RENAME TO `project`;--> statement-breakpoint
ALTER TABLE `Quest` RENAME TO `quest`;--> statement-breakpoint
ALTER TABLE `QuestToAssets` RENAME TO `quest_asset_link`;--> statement-breakpoint
ALTER TABLE `QuestToTags` RENAME TO `quest_tag_link`;--> statement-breakpoint
ALTER TABLE `Tag` RENAME TO `tag`;--> statement-breakpoint
ALTER TABLE `Translation` RENAME TO `translation`;--> statement-breakpoint
ALTER TABLE `Vote` RENAME TO `vote`;--> statement-breakpoint
ALTER TABLE `asset` RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE `asset` RENAME COLUMN "lastUpdated" TO "last_updated";--> statement-breakpoint
ALTER TABLE `asset` RENAME COLUMN "versionChainId" TO "version_chain_id";--> statement-breakpoint
ALTER TABLE `asset` RENAME COLUMN "sourceLanguageId" TO "source_language_id";--> statement-breakpoint
ALTER TABLE `asset_tag_link` RENAME COLUMN "assetId" TO "asset_id";--> statement-breakpoint
ALTER TABLE `asset_tag_link` RENAME COLUMN "tagId" TO "tag_id";--> statement-breakpoint
ALTER TABLE `language` RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE `language` RENAME COLUMN "lastUpdated" TO "last_updated";--> statement-breakpoint
ALTER TABLE `language` RENAME COLUMN "versionChainId" TO "version_chain_id";--> statement-breakpoint
ALTER TABLE `language` RENAME COLUMN "nativeName" TO "native_name";--> statement-breakpoint
ALTER TABLE `language` RENAME COLUMN "englishName" TO "english_name";--> statement-breakpoint
ALTER TABLE `language` RENAME COLUMN "uiReady" TO "ui_ready";--> statement-breakpoint
ALTER TABLE `language` RENAME COLUMN "creatorId" TO "creator_id";--> statement-breakpoint
ALTER TABLE `profile` RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE `profile` RENAME COLUMN "lastUpdated" TO "last_updated";--> statement-breakpoint
ALTER TABLE `profile` RENAME COLUMN "versionChainId" TO "version_chain_id";--> statement-breakpoint
ALTER TABLE `profile` RENAME COLUMN "uiLanguageId" TO "ui_language_id";--> statement-breakpoint
ALTER TABLE `project` RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE `project` RENAME COLUMN "lastUpdated" TO "last_updated";--> statement-breakpoint
ALTER TABLE `project` RENAME COLUMN "versionChainId" TO "version_chain_id";--> statement-breakpoint
ALTER TABLE `project` RENAME COLUMN "sourceLanguageId" TO "source_language_id";--> statement-breakpoint
ALTER TABLE `project` RENAME COLUMN "targetLanguageId" TO "target_language_id";--> statement-breakpoint
ALTER TABLE `quest` RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE `quest` RENAME COLUMN "lastUpdated" TO "last_updated";--> statement-breakpoint
ALTER TABLE `quest` RENAME COLUMN "versionChainId" TO "version_chain_id";--> statement-breakpoint
ALTER TABLE `quest` RENAME COLUMN "projectId" TO "project_id";--> statement-breakpoint
ALTER TABLE `quest_asset_link` RENAME COLUMN "questId" TO "quest_id";--> statement-breakpoint
ALTER TABLE `quest_asset_link` RENAME COLUMN "assetId" TO "asset_id";--> statement-breakpoint
ALTER TABLE `quest_tag_link` RENAME COLUMN "questId" TO "quest_id";--> statement-breakpoint
ALTER TABLE `quest_tag_link` RENAME COLUMN "tagId" TO "tag_id";--> statement-breakpoint
ALTER TABLE `tag` RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE `tag` RENAME COLUMN "lastUpdated" TO "last_updated";--> statement-breakpoint
ALTER TABLE `tag` RENAME COLUMN "versionChainId" TO "version_chain_id";--> statement-breakpoint
ALTER TABLE `translation` RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE `translation` RENAME COLUMN "lastUpdated" TO "last_updated";--> statement-breakpoint
ALTER TABLE `translation` RENAME COLUMN "versionChainId" TO "version_chain_id";--> statement-breakpoint
ALTER TABLE `translation` RENAME COLUMN "assetId" TO "asset_id";--> statement-breakpoint
ALTER TABLE `translation` RENAME COLUMN "targetLanguageId" TO "target_language_id";--> statement-breakpoint
ALTER TABLE `translation` RENAME COLUMN "creatorId" TO "creator_id";--> statement-breakpoint
ALTER TABLE `vote` RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE `vote` RENAME COLUMN "lastUpdated" TO "last_updated";--> statement-breakpoint
ALTER TABLE `vote` RENAME COLUMN "versionChainId" TO "version_chain_id";--> statement-breakpoint
ALTER TABLE `vote` RENAME COLUMN "translationId" TO "translation_id";--> statement-breakpoint
ALTER TABLE `vote` RENAME COLUMN "creatorId" TO "creator_id";--> statement-breakpoint
CREATE TABLE `asset_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_updated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version_chain_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`quest_subscription_id` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quest_subscription_id`) REFERENCES `quest_subscription`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invite_request` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_updated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version_chain_id` text NOT NULL,
	`sender_profile_id` text NOT NULL,
	`receiver_profile_id` text NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`sender_profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiver_profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notification` (
	`id` text NOT NULL,
	`rev` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_updated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version_chain_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`project_subscription_id` text,
	`quest_subscription_id` text,
	`asset_subscription_id` text,
	`translation_subscription_id` text,
	`invite_request_id` text,
	`event_type` text NOT NULL,
	`viewed` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_subscription_id`) REFERENCES `project_subscription`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quest_subscription_id`) REFERENCES `quest_subscription`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_subscription_id`) REFERENCES `asset_subscription`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`translation_subscription_id`) REFERENCES `translation_subscription`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invite_request_id`) REFERENCES `invite_request`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_updated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version_chain_id` text NOT NULL,
	`project_id` text NOT NULL,
	`profile_id` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quest_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_updated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version_chain_id` text NOT NULL,
	`quest_id` text NOT NULL,
	`project_subscription_id` text NOT NULL,
	FOREIGN KEY (`quest_id`) REFERENCES `quest`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_subscription_id`) REFERENCES `project_subscription`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `translation_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_updated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version_chain_id` text NOT NULL,
	`translation_id` text NOT NULL,
	`profile_id` text NOT NULL,
	FOREIGN KEY (`translation_id`) REFERENCES `translation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_updated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version_chain_id` text NOT NULL,
	`name` text NOT NULL,
	`source_language_id` text NOT NULL,
	`text` text NOT NULL,
	`images` text,
	`audio` text
);
--> statement-breakpoint
INSERT INTO `__new_asset`("id", "rev", "created_at", "last_updated", "version_chain_id", "name", "source_language_id", "text", "images", "audio") SELECT "id", "rev", "created_at", "last_updated", "version_chain_id", "name", "source_language_id", "text", "images", "audio" FROM `asset`;--> statement-breakpoint
DROP TABLE `asset`;--> statement-breakpoint
ALTER TABLE `__new_asset` RENAME TO `asset`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_asset_tag_link` (
	`asset_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`asset_id`, `tag_id`),
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_asset_tag_link`("asset_id", "tag_id") SELECT "asset_id", "tag_id" FROM `asset_tag_link`;--> statement-breakpoint
DROP TABLE `asset_tag_link`;--> statement-breakpoint
ALTER TABLE `__new_asset_tag_link` RENAME TO `asset_tag_link`;--> statement-breakpoint
CREATE TABLE `__new_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_updated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version_chain_id` text NOT NULL,
	`username` text,
	`password` text,
	`ui_language_id` text
);
--> statement-breakpoint
INSERT INTO `__new_profile`("id", "rev", "created_at", "last_updated", "version_chain_id", "username", "password", "ui_language_id") SELECT "id", "rev", "created_at", "last_updated", "version_chain_id", "username", "password", "ui_language_id" FROM `profile`;--> statement-breakpoint
DROP TABLE `profile`;--> statement-breakpoint
ALTER TABLE `__new_profile` RENAME TO `profile`;--> statement-breakpoint
CREATE TABLE `__new_quest_asset_link` (
	`quest_id` text NOT NULL,
	`asset_id` text NOT NULL,
	PRIMARY KEY(`quest_id`, `asset_id`),
	FOREIGN KEY (`quest_id`) REFERENCES `quest`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_quest_asset_link`("quest_id", "asset_id") SELECT "quest_id", "asset_id" FROM `quest_asset_link`;--> statement-breakpoint
DROP TABLE `quest_asset_link`;--> statement-breakpoint
ALTER TABLE `__new_quest_asset_link` RENAME TO `quest_asset_link`;--> statement-breakpoint
CREATE TABLE `__new_quest_tag_link` (
	`quest_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`quest_id`, `tag_id`),
	FOREIGN KEY (`quest_id`) REFERENCES `quest`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_quest_tag_link`("quest_id", "tag_id") SELECT "quest_id", "tag_id" FROM `quest_tag_link`;--> statement-breakpoint
DROP TABLE `quest_tag_link`;--> statement-breakpoint
ALTER TABLE `__new_quest_tag_link` RENAME TO `quest_tag_link`;--> statement-breakpoint
CREATE TABLE `__new_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_updated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version_chain_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`target_language_id` text NOT NULL,
	`text` text NOT NULL,
	`audio` text,
	`creator_id` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_language_id`) REFERENCES `language`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_translation`("id", "rev", "created_at", "last_updated", "version_chain_id", "asset_id", "target_language_id", "text", "audio", "creator_id") SELECT "id", "rev", "created_at", "last_updated", "version_chain_id", "asset_id", "target_language_id", "text", "audio", "creator_id" FROM `translation`;--> statement-breakpoint
DROP TABLE `translation`;--> statement-breakpoint
ALTER TABLE `__new_translation` RENAME TO `translation`;--> statement-breakpoint
CREATE TABLE `__new_vote` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_updated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version_chain_id` text NOT NULL,
	`translation_id` text NOT NULL,
	`polarity` text NOT NULL,
	`comment` text,
	`creator_id` text NOT NULL,
	FOREIGN KEY (`translation_id`) REFERENCES `translation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_vote`("id", "rev", "created_at", "last_updated", "version_chain_id", "translation_id", "polarity", "comment", "creator_id") SELECT "id", "rev", "created_at", "last_updated", "version_chain_id", "translation_id", "polarity", "comment", "creator_id" FROM `vote`;--> statement-breakpoint
DROP TABLE `vote`;--> statement-breakpoint
ALTER TABLE `__new_vote` RENAME TO `vote`;