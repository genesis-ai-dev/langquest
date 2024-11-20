PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_Language` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`versionChainId` text NOT NULL,
	`versionNum` integer NOT NULL,
	`nativeName` text,
	`englishName` text,
	`iso639_3` text,
	`uiReady` integer NOT NULL,
	`creatorId` text
);
--> statement-breakpoint
INSERT INTO `__new_Language`("id", "rev", "createdAt", "lastUpdated", "versionChainId", "versionNum", "nativeName", "englishName", "iso639_3", "uiReady", "creatorId") SELECT "id", "rev", "createdAt", "lastUpdated", "versionChainId", "versionNum", "nativeName", "englishName", "iso639_3", "uiReady", "creatorId" FROM `Language`;--> statement-breakpoint
DROP TABLE `Language`;--> statement-breakpoint
ALTER TABLE `__new_Language` RENAME TO `Language`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_User` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`versionChainId` text NOT NULL,
	`versionNum` integer NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`uiLanguageId` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_User`("id", "rev", "createdAt", "lastUpdated", "versionChainId", "versionNum", "username", "password", "uiLanguageId") SELECT "id", "rev", "createdAt", "lastUpdated", "versionChainId", "versionNum", "username", "password", "uiLanguageId" FROM `User`;--> statement-breakpoint
DROP TABLE `User`;--> statement-breakpoint
ALTER TABLE `__new_User` RENAME TO `User`;