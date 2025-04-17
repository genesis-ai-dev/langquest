CREATE TABLE `asset_content_link` (
	`id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`asset_id` text NOT NULL,
	`text` text NOT NULL,
	`audio_id` text,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `asset_download` (
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`profile_id` text NOT NULL,
	`asset_id` text NOT NULL,
	PRIMARY KEY(`profile_id`, `asset_id`)
);
--> statement-breakpoint
CREATE TABLE `project_download` (
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`profile_id` text NOT NULL,
	`project_id` text NOT NULL,
	PRIMARY KEY(`profile_id`, `project_id`)
);
--> statement-breakpoint
CREATE TABLE `quest_download` (
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`profile_id` text NOT NULL,
	`quest_id` text NOT NULL,
	PRIMARY KEY(`profile_id`, `quest_id`)
);
--> statement-breakpoint
DROP TABLE `asset_subscription`;--> statement-breakpoint
DROP TABLE `invite_request`;--> statement-breakpoint
DROP TABLE `notification`;--> statement-breakpoint
DROP TABLE `project_subscription`;--> statement-breakpoint
DROP TABLE `quest_subscription`;--> statement-breakpoint
DROP TABLE `translation_subscription`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_asset_tag_link` (
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`asset_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`asset_id`, `tag_id`)
);
--> statement-breakpoint
INSERT INTO `__new_asset_tag_link`("active", "created_at", "last_updated", "asset_id", "tag_id") SELECT "active", "created_at", "last_updated", "asset_id", "tag_id" FROM `asset_tag_link`;--> statement-breakpoint
DROP TABLE `asset_tag_link`;--> statement-breakpoint
ALTER TABLE `__new_asset_tag_link` RENAME TO `asset_tag_link`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_quest_asset_link` (
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`quest_id` text NOT NULL,
	`asset_id` text NOT NULL,
	PRIMARY KEY(`quest_id`, `asset_id`)
);
--> statement-breakpoint
INSERT INTO `__new_quest_asset_link`("active", "created_at", "last_updated", "quest_id", "asset_id") SELECT "active", "created_at", "last_updated", "quest_id", "asset_id" FROM `quest_asset_link`;--> statement-breakpoint
DROP TABLE `quest_asset_link`;--> statement-breakpoint
ALTER TABLE `__new_quest_asset_link` RENAME TO `quest_asset_link`;--> statement-breakpoint
CREATE TABLE `__new_quest_tag_link` (
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`quest_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`quest_id`, `tag_id`)
);
--> statement-breakpoint
INSERT INTO `__new_quest_tag_link`("active", "created_at", "last_updated", "quest_id", "tag_id") SELECT "active", "created_at", "last_updated", "quest_id", "tag_id" FROM `quest_tag_link`;--> statement-breakpoint
DROP TABLE `quest_tag_link`;--> statement-breakpoint
ALTER TABLE `__new_quest_tag_link` RENAME TO `quest_tag_link`;--> statement-breakpoint
CREATE TABLE `__new_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`name` text NOT NULL,
	`source_language_id` text NOT NULL,
	`images` text,
	FOREIGN KEY (`source_language_id`) REFERENCES `language`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_asset`("id", "active", "created_at", "last_updated", "name", "source_language_id", "images") SELECT "id", "active", "created_at", "last_updated", "name", "source_language_id", "images" FROM `asset`;--> statement-breakpoint
DROP TABLE `asset`;--> statement-breakpoint
ALTER TABLE `__new_asset` RENAME TO `asset`;--> statement-breakpoint
CREATE TABLE `__new_language` (
	`id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`native_name` text,
	`english_name` text,
	`iso639_3` text,
	`ui_ready` integer NOT NULL,
	`creator_id` text,
	FOREIGN KEY (`creator_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_language`("id", "active", "created_at", "last_updated", "native_name", "english_name", "iso639_3", "ui_ready", "creator_id") SELECT "id", "active", "created_at", "last_updated", "native_name", "english_name", "iso639_3", "ui_ready", "creator_id" FROM `language`;--> statement-breakpoint
DROP TABLE `language`;--> statement-breakpoint
ALTER TABLE `__new_language` RENAME TO `language`;--> statement-breakpoint
CREATE TABLE `__new_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`username` text,
	`password` text,
	`avatar` text,
	`ui_language_id` text,
	`terms_accepted` integer,
	`terms_version` text
);
--> statement-breakpoint
INSERT INTO `__new_profile`("id", "active", "created_at", "last_updated", "username", "password", "avatar", "ui_language_id", "terms_accepted", "terms_version") SELECT "id", "active", "created_at", "last_updated", "username", "password", "avatar", "ui_language_id", "terms_accepted", "terms_version" FROM `profile`;--> statement-breakpoint
DROP TABLE `profile`;--> statement-breakpoint
ALTER TABLE `__new_profile` RENAME TO `profile`;--> statement-breakpoint
CREATE TABLE `__new_project` (
	`id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`source_language_id` text NOT NULL,
	`target_language_id` text NOT NULL,
	FOREIGN KEY (`source_language_id`) REFERENCES `language`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_language_id`) REFERENCES `language`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_project`("id", "active", "created_at", "last_updated", "name", "description", "source_language_id", "target_language_id") SELECT "id", "active", "created_at", "last_updated", "name", "description", "source_language_id", "target_language_id" FROM `project`;--> statement-breakpoint
DROP TABLE `project`;--> statement-breakpoint
ALTER TABLE `__new_project` RENAME TO `project`;--> statement-breakpoint
CREATE TABLE `__new_quest` (
	`id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`project_id` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_quest`("id", "active", "created_at", "last_updated", "name", "description", "project_id") SELECT "id", "active", "created_at", "last_updated", "name", "description", "project_id" FROM `quest`;--> statement-breakpoint
DROP TABLE `quest`;--> statement-breakpoint
ALTER TABLE `__new_quest` RENAME TO `quest`;--> statement-breakpoint
CREATE TABLE `__new_tag` (
	`id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_tag`("id", "active", "created_at", "last_updated", "name") SELECT "id", "active", "created_at", "last_updated", "name" FROM `tag`;--> statement-breakpoint
DROP TABLE `tag`;--> statement-breakpoint
ALTER TABLE `__new_tag` RENAME TO `tag`;--> statement-breakpoint
CREATE TABLE `__new_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`asset_id` text NOT NULL,
	`target_language_id` text NOT NULL,
	`text` text,
	`audio` text,
	`creator_id` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_language_id`) REFERENCES `language`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_translation`("id", "active", "created_at", "last_updated", "asset_id", "target_language_id", "text", "audio", "creator_id") SELECT "id", "active", "created_at", "last_updated", "asset_id", "target_language_id", "text", "audio", "creator_id" FROM `translation`;--> statement-breakpoint
DROP TABLE `translation`;--> statement-breakpoint
ALTER TABLE `__new_translation` RENAME TO `translation`;--> statement-breakpoint
CREATE TABLE `__new_vote` (
	`id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`last_updated` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`translation_id` text NOT NULL,
	`polarity` text NOT NULL,
	`comment` text,
	`creator_id` text NOT NULL,
	FOREIGN KEY (`translation_id`) REFERENCES `translation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_vote`("id", "active", "created_at", "last_updated", "translation_id", "polarity", "comment", "creator_id") SELECT "id", "active", "created_at", "last_updated", "translation_id", "polarity", "comment", "creator_id" FROM `vote`;--> statement-breakpoint
DROP TABLE `vote`;--> statement-breakpoint
ALTER TABLE `__new_vote` RENAME TO `vote`;