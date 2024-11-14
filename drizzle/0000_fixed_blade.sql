CREATE TABLE `languaged` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`nativeName` text,
	`englishName` text,
	`iso639_3` text,
	`versionChainId` text NOT NULL,
	`versionNum` integer NOT NULL,
	`uiReady` integer NOT NULL,
	`creatorId` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `userd` (
	`id` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`icon` text,
	`versionChainId` text NOT NULL,
	`versionNum` integer NOT NULL,
	`achievements` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP,
	`lastUpdated` text DEFAULT CURRENT_TIMESTAMP
);
