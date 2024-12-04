import { column, Schema, Table } from '@powersync/react-native';


const baseColumns = {
    rev: column.integer,
    createdAt: column.text,
    lastUpdated: column.text
};


const User = new Table({
    ...baseColumns,
    username: column.text,
    password: column.text,
    // icon: column.text,
    // achievements: column.text,
    uiLanguageId: column.text
});

const Language = new Table({
    ...baseColumns,
    nativeName: column.text,
    englishName: column.text,
    iso639_3: column.text,
    uiReady: column.integer,
    creatorId: column.text
});

const Project = new Table({
    ...baseColumns,
    name: column.text,
    description: column.text,
    sourceLanguageId: column.text,
    targetLanguageId: column.text
});

const Quest = new Table({
    ...baseColumns,
    name: column.text,
    description: column.text,
    projectId: column.text,
});

const Tag = new Table({
    ...baseColumns,
    name: column.text,
});

const QuestToTags = new Table({
    questId: column.text,
    tagId: column.text,
}, {
    indexes: {
        pk: ['questId', 'tagId'],
    }
});

const Asset = new Table({
    ...baseColumns,
    name: column.text,
    sourceLanguageId: column.text,
    text: column.text,
    images: column.text,
    audio: column.text,
});

const AssetToTags = new Table({
    assetId: column.text,
    tagId: column.text,
}, {
    indexes: {
        pk: ['assetId', 'tagId'],
    }
});

const QuestToAssets = new Table({
    questId: column.text,
    assetId: column.text,
}, { 
    indexes: {
        pk: ['questId', 'assetId'],
    }
});

const Translations = new Table({
    ...baseColumns,
    assetId: column.text,
    targetLanguageId: column.text,
    test: column.text,
    audio: column.text,
    creatorId: column.text,
});

const Vote = new Table({
    ...baseColumns,
    translationId: column.text,
    polarity: column.text,
    comment: column.text,
    creatorId: column.text,
});

export const AppSchema = new Schema([
    User, 
    Language, 
    Project, 
    Quest, 
    Tag,
    QuestToTags,
    Asset,
    AssetToTags,
    QuestToAssets,
    Translations,
    Vote
]);
