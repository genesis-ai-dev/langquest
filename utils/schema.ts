export const schemaSQL = `
-- Enable foreign key support
PRAGMA foreign_keys = ON;

-- User table
CREATE TABLE User (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    username TEXT NOT NULL UNIQUE,
    icon BLOB,
    versionNum INTEGER NOT NULL,
    lastVersion TEXT,
    nextVersion TEXT,
    uiLanguage TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lastVersion) REFERENCES User(id),
    FOREIGN KEY (nextVersion) REFERENCES User(id),
    FOREIGN KEY (uiLanguage) REFERENCES Language(id)
);

-- Project table
CREATE TABLE Project (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    name TEXT NOT NULL,
    icon BLOB,
    description TEXT,
    versionNum INTEGER NOT NULL,
    lastVersion TEXT,
    nextVersion TEXT,
    sourceLanguage TEXT NOT NULL,
    targetLanguage TEXT NOT NULL,
    creator TEXT NOT NULL,
    shareable BOOLEAN NOT NULL,
    publiclyAccessible BOOLEAN NOT NULL,
    publiclyVisible BOOLEAN NOT NULL,
    published BOOLEAN NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lastVersion) REFERENCES Project(id),
    FOREIGN KEY (nextVersion) REFERENCES Project(id),
    FOREIGN KEY (sourceLanguage) REFERENCES Language(id),
    FOREIGN KEY (targetLanguage) REFERENCES Language(id),
    FOREIGN KEY (creator) REFERENCES User(id)
);

-- ProjectMember table (for many-to-many relationship between User and Project)
CREATE TABLE ProjectMember (
    userId TEXT,
    projectId TEXT,
    isLead BOOLEAN NOT NULL,
    PRIMARY KEY (userId, projectId),
    FOREIGN KEY (userId) REFERENCES User(id),
    FOREIGN KEY (projectId) REFERENCES Project(id)
);

-- Quest table
CREATE TABLE Quest (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    versionNum INTEGER NOT NULL,
    lastVersion TEXT,
    nextVersion TEXT,
    project TEXT NOT NULL,
    shareable BOOLEAN NOT NULL,
    creator TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lastVersion) REFERENCES Quest(id),
    FOREIGN KEY (nextVersion) REFERENCES Quest(id),
    FOREIGN KEY (project) REFERENCES Project(id),
    FOREIGN KEY (creator) REFERENCES User(id)
);

-- Asset table
CREATE TABLE Asset (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    name TEXT NOT NULL,
    versionNum INTEGER NOT NULL,
    lastVersion TEXT,
    nextVersion TEXT,
    sourceLanguage TEXT NOT NULL,
    text TEXT,
    attachments BLOB,
    shareable BOOLEAN NOT NULL,
    creator TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lastVersion) REFERENCES Asset(id),
    FOREIGN KEY (nextVersion) REFERENCES Asset(id),
    FOREIGN KEY (sourceLanguage) REFERENCES Language(id),
    FOREIGN KEY (creator) REFERENCES User(id)
);

-- QuestAsset table (for many-to-many relationship between Quest and Asset)
CREATE TABLE QuestAsset (
    questId TEXT,
    assetId TEXT,
    PRIMARY KEY (questId, assetId),
    FOREIGN KEY (questId) REFERENCES Quest(id),
    FOREIGN KEY (assetId) REFERENCES Asset(id)
);

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

-- Language table
CREATE TABLE Language (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    nativeName TEXT NOT NULL,
    englishName TEXT NOT NULL,
    iso639_3 TEXT UNIQUE,
    uiReady BOOLEAN NOT NULL,
    creator TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator) REFERENCES User(id)
);

-- AccessCode table
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

-- LanguageRequest table
CREATE TABLE LanguageRequest (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    language TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (language) REFERENCES Language(id)
);

-- FlagAssignment table
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

-- TagName table
CREATE TABLE TagName (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    name TEXT NOT NULL UNIQUE,
    creator TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator) REFERENCES User(id)
);

-- TagAssignment table
CREATE TABLE TagAssignment (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    tagName TEXT NOT NULL,
    quest TEXT,
    asset TEXT,
    project TEXT NOT NULL,
    assigner TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tagName) REFERENCES TagName(id),
    FOREIGN KEY (quest) REFERENCES Quest(id),
    FOREIGN KEY (asset) REFERENCES Asset(id),
    FOREIGN KEY (project) REFERENCES Project(id),
    FOREIGN KEY (assigner) REFERENCES User(id),
    CHECK ((quest IS NULL AND asset IS NOT NULL) OR (quest IS NOT NULL AND asset IS NULL))
);

-- ProjectTag table (for many-to-many relationship between Project and TagName)
CREATE TABLE ProjectTag (
    projectId TEXT,
    tagNameId TEXT,
    PRIMARY KEY (projectId, tagNameId),
    FOREIGN KEY (projectId) REFERENCES Project(id),
    FOREIGN KEY (tagNameId) REFERENCES TagName(id)
);

-- InviteRequest table
CREATE TABLE InviteRequest (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rev INTEGER NOT NULL,
    sender TEXT NOT NULL,
    receiver TEXT NOT NULL,
    project TEXT NOT NULL,
    status TEXT CHECK(status IN ('waiting', 'approved', 'rejected', 'passed')) NOT NULL,
    versionNum INTEGER NOT NULL,
    lastVersion TEXT,
    nextVersion TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender) REFERENCES User(id),
    FOREIGN KEY (receiver) REFERENCES User(id),
    FOREIGN KEY (project) REFERENCES Project(id),
    FOREIGN KEY (lastVersion) REFERENCES InviteRequest(id),
    FOREIGN KEY (nextVersion) REFERENCES InviteRequest(id)
);
`;