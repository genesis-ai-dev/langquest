import { int, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

// Create a type from your actual icon files
type IconName = `${string}.png`;  // Matches any .png filename

const uuidDefault = sql`(lower(hex(randomblob(16))))`;
const timestampDefault = sql`CURRENT_TIMESTAMP`;

// Base columns that all tables will have
const baseColumns = {
  id: text().primaryKey().$defaultFn(() => uuidDefault),
  rev: int().notNull(),
  createdAt: text().notNull().default(timestampDefault),
  lastUpdated: text().notNull().default(timestampDefault),
  versionChainId: text().notNull(),
};

export const user = sqliteTable("User", {
  ...baseColumns,
  username: text().notNull(),
  password: text().notNull(),
  // icon: text().$type<IconName>(),
  // achievements: text(),
  uiLanguageId: text().notNull(),
});

export const userRelations = relations(user, ({ many, one }) => ({
  createdLanguages: many(language, { relationName: 'creator' }),
  uiLanguage: one(language, {  
    fields: [user.uiLanguageId],
    references: [language.id],
  }),
  sourceLanguageProjects: many(project, { relationName: 'sourceLanguage' }),
  targetLanguageProjects: many(project, { relationName: 'targetLanguage' })
}));

export const language = sqliteTable("Language", {
  ...baseColumns,
  // Enforce the existence of either nativeName or englishName in the app
  nativeName: text(), // Enforce uniqueness across chains in the app
  englishName: text(), // Enforce uniqueness across chains in the app
  iso639_3: text(), // Enforce uniqueness across chains in the app
  uiReady: int({ mode: 'boolean' }).notNull(),
  creatorId: text(),
});

export const languageRelations = relations(language, ({ one, many }) => ({
  creator: one(user, {
    fields: [language.creatorId],
    references: [user.id],
  }),
  uiUsers: many(user, { relationName: 'uiLanguage' }),
}));

export const project = sqliteTable("Project", {
  ...baseColumns,
  name: text().notNull(),
  description: text(),
  sourceLanguageId: text().notNull(),
  targetLanguageId: text().notNull(),
});

export const projectRelations = relations(project, ({ one }) => ({
  sourceLanguage: one(language, {
    fields: [project.sourceLanguageId],
    references: [language.id],
  }),
  targetLanguage: one(language, {
    fields: [project.targetLanguageId],
    references: [language.id],
  }),
}));

export const quest = sqliteTable("Quest", {
  ...baseColumns,
  name: text().notNull(),
  description: text(),
  projectId: text().notNull(),
});

export const questRelations = relations(quest, ({ one, many }) => ({
  project: one(project, {
    fields: [quest.projectId],
    references: [project.id],
  }),
  tags: many(questToTags),
  assets: many(questToAssets),
}));

export const tag = sqliteTable("Tag", {
  ...baseColumns,
  name: text().notNull(),
});

export const tagRelations = relations(tag, ({ many }) => ({
  quests: many(questToTags),
  assets: many(assetToTags),
}));

export const questToTags = sqliteTable("QuestToTags", {
    questId: text()
      .notNull()
      .references(() => quest.id),
    tagId: text()
      .notNull() 
      .references(() => tag.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.questId, t.tagId] }),
  })
);

export const questToTagsRelations = relations(questToTags, ({ one }) => ({
  quest: one(quest, {
    fields: [questToTags.questId],
    references: [quest.id],
  }),
  tag: one(tag, {
    fields: [questToTags.tagId], 
    references: [tag.id],
  }),
}));

export const asset = sqliteTable("Asset", {
  ...baseColumns,
  name: text().notNull(),
  sourceLanguageId: text().notNull(),
  text: text().notNull(),
  images: text({ mode: 'json' }).$type<string[]>(),
  audio: text({ mode: 'json' }).$type<string[]>(),
});

export const assetRelations = relations(asset, ({ one, many }) => ({
  sourceLanguage: one(language, {
    fields: [asset.sourceLanguageId],
    references: [language.id],
  }),
  tags: many(assetToTags),
  quests: many(questToAssets),
  translations: many(translation),
}));

export const assetToTags = sqliteTable(
  "AssetToTags",
  {
    assetId: text()
      .notNull()
      .references(() => asset.id),
    tagId: text()
      .notNull()
      .references(() => tag.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.assetId, t.tagId] }),
  })
);

export const assetToTagsRelations = relations(assetToTags, ({ one }) => ({
  asset: one(asset, {
    fields: [assetToTags.assetId],
    references: [asset.id],
  }),
  tag: one(tag, {
    fields: [assetToTags.tagId],
    references: [tag.id],
  }),
}));

export const questToAssets = sqliteTable(
  "QuestToAssets",
  {
    questId: text()
      .notNull()
      .references(() => quest.id),
    assetId: text()
      .notNull()
      .references(() => asset.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.questId, t.assetId] }),
  })
);

export const questToAssetsRelations = relations(questToAssets, ({ one }) => ({
  quest: one(quest, {
    fields: [questToAssets.questId],
    references: [quest.id],
  }),
  asset: one(asset, {
    fields: [questToAssets.assetId],
    references: [asset.id],
  }),
}));

export const translation = sqliteTable("Translation", {
  ...baseColumns,
  assetId: text().notNull().references(() => asset.id),
  targetLanguageId: text().notNull().references(() => language.id),
  text: text().notNull(),
  audio: text({ mode: 'json' }).$type<string[]>(),
  creatorId: text().notNull().references(() => user.id),
});

export const translationRelations = relations(translation, ({ one, many }) => ({
  asset: one(asset, {
    fields: [translation.assetId],
    references: [asset.id],
  }),
  targetLanguage: one(language, {
    fields: [translation.targetLanguageId],
    references: [language.id],
  }),
  creator: one(user, {
    fields: [translation.creatorId],
    references: [user.id],
  }),
  votes: many(vote),
}));

export const vote = sqliteTable("Vote", {
  ...baseColumns,
  translationId: text().notNull().references(() => translation.id),
  polarity: text().notNull(), // "up" or "down"
  comment: text(),
  creatorId: text().notNull().references(() => user.id),
});

export const voteRelations = relations(vote, ({ one }) => ({
  translation: one(translation, {
    fields: [vote.translationId],
    references: [translation.id],
  }),
  creator: one(user, {
    fields: [vote.creatorId],
    references: [user.id],
  }),
}));
