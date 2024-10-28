export const schemaSQL = `
-- Enable foreign key support
PRAGMA foreign_keys = ON;

-- User table
CREATE TABLE User (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    icon BLOB,
    versionChainId TEXT NOT NULL,
    versionNum INTEGER NOT NULL,
    uiLanguage TEXT NOT NULL,
    achievements TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uiLanguage) REFERENCES Language(id)
);

-- Rule: Usernames must be unique across different version chains
-- (i.e., two different users can't have the same username)
CREATE TRIGGER enforce_username_uniqueness
BEFORE INSERT ON User
BEGIN
    SELECT CASE 
        -- Check if a user with same username exists in a different chain
        WHEN EXISTS (
            SELECT 1 FROM User 
            WHERE username = NEW.username 
            AND versionChainId != NEW.versionChainId
        )
        THEN RAISE(ABORT, 'Username must be unique across different version chains')
    END;
END;

CREATE TRIGGER update_user_timestamp
AFTER UPDATE ON User
BEGIN
    UPDATE User 
    SET lastUpdated = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER update_user_timestamp
AFTER UPDATE ON User
BEGIN
    UPDATE User 
    SET lastUpdated = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

------------------------------------------------------------

CREATE TABLE Project (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    name TEXT NOT NULL,
    icon BLOB,
    description TEXT,
    versionChainId TEXT NOT NULL,
    versionNum INTEGER NOT NULL,
    sourceLanguage TEXT NOT NULL,
    targetLanguage TEXT NOT NULL,
    creator TEXT NOT NULL,
    shareable BOOLEAN NOT NULL,
    publiclyAccessible BOOLEAN NOT NULL,
    publiclyVisible BOOLEAN NOT NULL,
    published BOOLEAN NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sourceLanguage) REFERENCES Language(id),
    FOREIGN KEY (targetLanguage) REFERENCES Language(id),
    FOREIGN KEY (creator) REFERENCES User(id)
);

-- Rule: Projects with same source and target languages must have unique names
-- (unless they're versions of the same project)
CREATE TRIGGER enforce_project_name_uniqueness
BEFORE INSERT ON Project
BEGIN
    SELECT CASE 
        WHEN EXISTS (
            SELECT 1 FROM Project 
            WHERE name = NEW.name 
            AND sourceLanguage = NEW.sourceLanguage 
            AND targetLanguage = NEW.targetLanguage 
            AND versionChainId != NEW.versionChainId
        )
        THEN RAISE(ABORT, 'Project name must be unique for the same language pair')
    END;
END;

-- Rule: Public projects must be visible (split into two triggers)
CREATE TRIGGER enforce_project_visibility_insert
BEFORE INSERT ON Project
BEGIN
    SELECT CASE 
        WHEN NEW.publiclyAccessible = 1 AND NEW.publiclyVisible = 0
        THEN RAISE(ABORT, 'Public projects must also be visible')
    END;
END;

CREATE TRIGGER enforce_project_visibility_update
BEFORE UPDATE ON Project
BEGIN
    SELECT CASE 
        WHEN NEW.publiclyAccessible = 1 AND NEW.publiclyVisible = 0
        THEN RAISE(ABORT, 'Public projects must also be visible')
    END;
END;

CREATE TRIGGER update_project_timestamp
AFTER UPDATE ON Project
BEGIN
    UPDATE Project 
    SET lastUpdated = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

------------------------------------------------------------

-- ProjectMember table (for many-to-many relationship between User and Project)
CREATE TABLE ProjectMember (
    userId TEXT NOT NULL,
    projectId TEXT NOT NULL,
    isLead BOOLEAN NOT NULL,
    PRIMARY KEY (userId, projectId),
    FOREIGN KEY (userId) REFERENCES User(id),
    FOREIGN KEY (projectId) REFERENCES Project(id)
);

------------------------------------------------------------

-- Quest table
CREATE TABLE Quest (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    versionChainId TEXT NOT NULL,
    versionNum INTEGER NOT NULL,
    project TEXT NOT NULL,
    shareable BOOLEAN NOT NULL,
    creator TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project) REFERENCES Project(id),
    FOREIGN KEY (creator) REFERENCES User(id)
);

-- Rule: Quest names must be unique within a project
-- (unless they're versions of the same quest)
CREATE TRIGGER enforce_quest_uniqueness
BEFORE INSERT ON Quest
BEGIN
    SELECT CASE 
        -- Check if a quest with same name exists in same project but different chain
        WHEN EXISTS (
            SELECT 1 FROM Quest 
            WHERE name = NEW.name 
            AND project = NEW.project 
            AND versionChainId != NEW.versionChainId
        )
        THEN RAISE(ABORT, 'Quest name must be unique within project across different version chains')
    END;
END;

CREATE TRIGGER update_quest_timestamp
AFTER UPDATE ON Quest
BEGIN
    UPDATE Quest 
    SET lastUpdated = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

------------------------------------------------------------

-- Asset table
CREATE TABLE Asset (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    name TEXT NOT NULL,
    versionChainId TEXT NOT NULL,
    versionNum INTEGER NOT NULL,
    sourceLanguage TEXT NOT NULL,
    text TEXT,
    attachments BLOB,
    shareable BOOLEAN NOT NULL,
    creator TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sourceLanguage) REFERENCES Language(id),
    FOREIGN KEY (creator) REFERENCES User(id)
);

-- Rule: Asset names must be unique within a quest
-- (unless they're versions of the same asset)
CREATE TRIGGER enforce_asset_uniqueness
BEFORE INSERT ON Asset
BEGIN
    SELECT CASE 
        WHEN EXISTS (
            SELECT 1 FROM Asset a
            JOIN QuestAsset qa ON a.id = qa.assetId
            WHERE a.name = NEW.name 
            AND qa.questId IN (
                SELECT questId FROM QuestAsset WHERE assetId = NEW.id
            )
            AND a.versionChainId != NEW.versionChainId
        )
        THEN RAISE(ABORT, 'Asset name must be unique within quest across different version chains')
    END;
END;

CREATE TRIGGER update_asset_timestamp
AFTER UPDATE ON Asset
BEGIN
    UPDATE Asset 
    SET lastUpdated = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

------------------------------------------------------------

-- QuestAsset table (for many-to-many relationship between Quest and Asset)
CREATE TABLE QuestAsset (
    questId TEXT NOT NULL,
    assetId TEXT NOT NULL,
    PRIMARY KEY (questId, assetId),
    FOREIGN KEY (questId) REFERENCES Quest(id),
    FOREIGN KEY (assetId) REFERENCES Asset(id)
);

------------------------------------------------------------

-- Translation table
CREATE TABLE Translation (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    asset TEXT NOT NULL,
    targetLanguage TEXT NOT NULL,
    text TEXT,
    attachment BLOB,
    creator TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset) REFERENCES Asset(id),
    FOREIGN KEY (targetLanguage) REFERENCES Language(id),
    FOREIGN KEY (creator) REFERENCES User(id)
);

-- Rule: Translations must be unique per asset (split into two triggers)
CREATE TRIGGER enforce_translation_uniqueness_insert
BEFORE INSERT ON Translation
BEGIN
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM Translation
            WHERE asset = NEW.asset
            AND text = NEW.text
            AND id != NEW.id
        )
        THEN RAISE(ABORT, 'Translation text must be unique for the same asset')
    END;
END;

CREATE TRIGGER enforce_translation_uniqueness_update
BEFORE UPDATE ON Translation
BEGIN
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM Translation
            WHERE asset = NEW.asset
            AND text = NEW.text
            AND id != NEW.id
        )
        THEN RAISE(ABORT, 'Translation text must be unique for the same asset')
    END;
END;

CREATE TRIGGER update_translation_timestamp
AFTER UPDATE ON Translation
BEGIN
    UPDATE Translation 
    SET lastUpdated = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

------------------------------------------------------------

-- Vote table
CREATE TABLE Vote (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    translation TEXT NOT NULL,
    polarity TEXT CHECK(polarity IN ('positive', 'negative')) NOT NULL,
    creator TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (translation) REFERENCES Translation(id),
    FOREIGN KEY (creator) REFERENCES User(id)
);

-- Rule: Only one vote per user per translation
-- If multiple votes are attempted, keep only the newest one
CREATE TRIGGER enforce_vote_uniqueness
BEFORE INSERT ON Vote
BEGIN
    -- Delete any existing vote from this user for this translation
    DELETE FROM Vote 
    WHERE translation = NEW.translation 
    AND creator = NEW.creator
    AND createdAt < NEW.createdAt;
END;

CREATE TRIGGER update_vote_timestamp
AFTER UPDATE ON Vote
BEGIN
    UPDATE Vote 
    SET lastUpdated = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

------------------------------------------------------------

-- Language table
CREATE TABLE Language (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    nativeName TEXT NOT NULL,
    englishName TEXT NOT NULL,
    iso639_3 TEXT,
    versionChainId TEXT NOT NULL,
    versionNum INTEGER NOT NULL,
    uiReady BOOLEAN NOT NULL,
    creator TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator) REFERENCES User(id)
);

-- Create triggers to enforce Language uniqueness rules
CREATE TRIGGER enforce_language_uniqueness
BEFORE INSERT ON Language
BEGIN
    SELECT CASE 
        -- Check if a language with same names exists in different chain
        WHEN EXISTS (
            SELECT 1 FROM Language 
            WHERE (
                nativeName = NEW.nativeName OR 
                englishName = NEW.englishName OR 
                (iso639_3 = NEW.iso639_3 AND NEW.iso639_3 IS NOT NULL)
            )
            AND versionChainId != NEW.versionChainId
        )
        THEN RAISE(ABORT, 'Language names and ISO code must be unique across different version chains')
    END;
END;

CREATE TRIGGER update_language_timestamp
AFTER UPDATE ON Language
BEGIN
    UPDATE Language 
    SET lastUpdated = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

------------------------------------------------------------

CREATE TABLE AccessCode (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    code TEXT NOT NULL UNIQUE,
    project TEXT NOT NULL,
    creator TEXT NOT NULL,
    recipient TEXT,
    valid BOOLEAN NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project) REFERENCES Project(id),
    FOREIGN KEY (creator) REFERENCES User(id),
    FOREIGN KEY (recipient) REFERENCES User(id)
);

------------------------------------------------------------

CREATE TABLE LanguageRequest (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    language TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (language) REFERENCES Language(id)
);

------------------------------------------------------------

CREATE TABLE FlagAssignment (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    name TEXT NOT NULL,
    user TEXT NOT NULL,
    project TEXT NOT NULL,
    assigner TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user) REFERENCES User(id),
    FOREIGN KEY (project) REFERENCES Project(id),
    FOREIGN KEY (assigner) REFERENCES User(id)
);

CREATE TRIGGER update_flag_assignment_timestamp
AFTER UPDATE ON FlagAssignment
BEGIN
    UPDATE FlagAssignment 
    SET lastUpdated = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

------------------------------------------------------------

CREATE TABLE Tag (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    name TEXT NOT NULL,
    creator TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator) REFERENCES User(id)
);

CREATE TRIGGER enforce_tag_name_uniqueness
BEFORE INSERT ON Tag
BEGIN
    SELECT CASE 
        WHEN EXISTS (
            SELECT 1 FROM Tag 
            WHERE name = NEW.name
            AND id != NEW.id
        )
        THEN RAISE(ABORT, 'Tag name must be unique')
    END;
END;

CREATE TRIGGER update_tag_timestamp
AFTER UPDATE ON Tag
BEGIN
    UPDATE Tag 
    SET lastUpdated = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

------------------------------------------------------------

CREATE TABLE QuestTag (
    questId TEXT NOT NULL,
    tagId TEXT NOT NULL,
    PRIMARY KEY (questId, tagId),
    FOREIGN KEY (questId) REFERENCES Quest(id),
    FOREIGN KEY (tagId) REFERENCES Tag(id)
);

CREATE TABLE AssetTag (
    assetId TEXT NOT NULL,
    tagId TEXT NOT NULL,
    PRIMARY KEY (assetId, tagId),
    FOREIGN KEY (assetId) REFERENCES Asset(id),
    FOREIGN KEY (tagId) REFERENCES Tag(id)
);

------------------------------------------------------------

CREATE TABLE InviteRequest (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    sender TEXT NOT NULL,
    project TEXT NOT NULL,
    status TEXT CHECK(status IN ('waiting', 'approved', 'rejected', 'passed')) NOT NULL,
    versionChainId TEXT NOT NULL,
    versionNum INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender) REFERENCES User(id),
    FOREIGN KEY (project) REFERENCES Project(id)
);

CREATE TRIGGER update_invite_request_timestamp
AFTER UPDATE ON InviteRequest
BEGIN
    UPDATE InviteRequest 
    SET lastUpdated = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

------------------------------------------------------------

CREATE TABLE InviteRequestReceiver (
    inviteRequestId TEXT NOT NULL,
    receiverId TEXT NOT NULL,
    PRIMARY KEY (inviteRequestId, receiverId),
    FOREIGN KEY (inviteRequestId) REFERENCES InviteRequest(id),
    FOREIGN KEY (receiverId) REFERENCES User(id)
);

CREATE TRIGGER enforce_invite_request_status_update
BEFORE UPDATE ON InviteRequest
BEGIN
    SELECT CASE
        -- Can't change from final states
        WHEN OLD.status IN ('approved', 'rejected') 
        AND NEW.status != OLD.status
        THEN RAISE(ABORT, 'Cannot change status of finalized invite request')
        
        -- Can't skip waiting state
        WHEN OLD.status = 'passed' 
        AND NEW.status NOT IN ('waiting', OLD.status)
        THEN RAISE(ABORT, 'New invite requests must go through waiting state')
    END;
END;

CREATE TRIGGER enforce_invite_receiver_rules
BEFORE INSERT ON InviteRequestReceiver
BEGIN
    SELECT CASE
        -- Prevent self-invite
        WHEN EXISTS (
            SELECT 1 FROM InviteRequest 
            WHERE id = NEW.inviteRequestId 
            AND sender = NEW.receiverId
        )
        THEN RAISE(ABORT, 'Cannot invite yourself')
        
        -- Prevent inviting existing project members
        WHEN EXISTS (
            SELECT 1 
            FROM InviteRequest ir
            JOIN ProjectMember pm 
            ON pm.projectId = ir.project
            WHERE ir.id = NEW.inviteRequestId 
            AND pm.userId = NEW.receiverId
        )
        THEN RAISE(ABORT, 'User is already a project member')
    END;
END;

`;