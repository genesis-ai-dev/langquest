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
  created_at: text().notNull().default(timestampDefault),
  last_updated: text().notNull().default(timestampDefault),
  version_chain_id: text().notNull(),
};

export const profile = sqliteTable("profile", {
  ...baseColumns,
  username: text(),
  password: text(),
  // icon: text().$type<IconName>(),
  // achievements: text(),
  ui_language_id: text(),
});

export const userRelations = relations(profile, ({ many, one }) => ({
  created_languages: many(language, { relationName: 'creator' }),
  ui_language: one(language, {  
    fields: [profile.ui_language_id],
    references: [language.id],
  }),
  source_language_projects: many(project, { relationName: 'source_language' }),
  target_language_projects: many(project, { relationName: 'target_language' })
}));

export const language = sqliteTable("language", {
  ...baseColumns,
  // Enforce the existence of either native_name or english_name in the app
  native_name: text(), // Enforce uniqueness across chains in the app
  english_name: text(), // Enforce uniqueness across chains in the app
  iso639_3: text(), // Enforce uniqueness across chains in the app
  ui_ready: int({ mode: 'boolean' }).notNull(),
  creator_id: text(),
});

export const languageRelations = relations(language, ({ one, many }) => ({
  creator: one(profile, {
    fields: [language.creator_id],
    references: [profile.id],
  }),
  ui_users: many(profile, { relationName: 'ui_language' }),
}));

export const project = sqliteTable("project", {
  ...baseColumns,
  name: text().notNull(),
  description: text(),
  source_language_id: text().notNull(),
  target_language_id: text().notNull(),
});

export const projectRelations = relations(project, ({ one }) => ({
  source_language: one(language, {
    fields: [project.source_language_id],
    references: [language.id],
  }),
  target_language: one(language, {
    fields: [project.target_language_id],
    references: [language.id],
  }),
}));

export const quest = sqliteTable("quest", {
  ...baseColumns,
  name: text().notNull(),
  description: text(),
  project_id: text().notNull(),
});

export const questRelations = relations(quest, ({ one, many }) => ({
  project: one(project, {
    fields: [quest.project_id],
    references: [project.id],
  }),
  tags: many(quest_tag_link),
  assets: many(quest_asset_link),
}));

export const tag = sqliteTable("tag", {
  ...baseColumns,
  name: text().notNull(),
});

export const tagRelations = relations(tag, ({ many }) => ({
  quests: many(quest_tag_link),
  assets: many(asset_tag_link),
}));

export const quest_tag_link = sqliteTable("quest_tag_link", {
    quest_id: text()
      .notNull()
      .references(() => quest.id),
    tag_id: text()
      .notNull() 
      .references(() => tag.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.quest_id, t.tag_id] }),
  })
);

export const quest_tag_linkRelations = relations(quest_tag_link, ({ one }) => ({
  quest: one(quest, {
    fields: [quest_tag_link.quest_id],
    references: [quest.id],
  }),
  tag: one(tag, {
    fields: [quest_tag_link.tag_id], 
    references: [tag.id],
  }),
}));

export const asset = sqliteTable("asset", {
  ...baseColumns,
  name: text().notNull(),
  source_language_id: text().notNull(),
  text: text().notNull(),
  images: text({ mode: 'json' }).$type<string[]>(),
  audio: text({ mode: 'json' }).$type<string[]>(),
});

export const assetRelations = relations(asset, ({ one, many }) => ({
  source_language: one(language, {
    fields: [asset.source_language_id],
    references: [language.id],
  }),
  tags: many(asset_tag_link),
  quests: many(quest_asset_link),
  translations: many(translation),
}));

export const asset_tag_link = sqliteTable(
  "asset_tag_link",
  {
    asset_id: text()
      .notNull()
      .references(() => asset.id),
    tag_id: text()
      .notNull()
      .references(() => tag.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.asset_id, t.tag_id] }),
  })
);

export const asset_tag_linkRelations = relations(asset_tag_link, ({ one }) => ({
  asset: one(asset, {
    fields: [asset_tag_link.asset_id],
    references: [asset.id],
  }),
  tag: one(tag, {
    fields: [asset_tag_link.tag_id],
    references: [tag.id],
  }),
}));

export const quest_asset_link = sqliteTable(
  "quest_asset_link",
  {
    quest_id: text()
      .notNull()
      .references(() => quest.id),
    asset_id: text()
      .notNull()
      .references(() => asset.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.quest_id, t.asset_id] }),
  })
);

export const quest_asset_linkRelations = relations(quest_asset_link, ({ one }) => ({
  quest: one(quest, {
    fields: [quest_asset_link.quest_id],
    references: [quest.id],
  }),
  asset: one(asset, {
    fields: [quest_asset_link.asset_id],
    references: [asset.id],
  }),
}));

export const translation = sqliteTable("translation", {
  ...baseColumns,
  asset_id: text().notNull().references(() => asset.id),
  target_language_id: text().notNull().references(() => language.id),
  text: text().notNull(),
  audio: text({ mode: 'json' }).$type<string[]>(),
  creator_id: text().notNull().references(() => profile.id),
});

export const translationRelations = relations(translation, ({ one, many }) => ({
  asset: one(asset, {
    fields: [translation.asset_id],
    references: [asset.id],
  }),
  target_language: one(language, {
    fields: [translation.target_language_id],
    references: [language.id],
  }),
  creator: one(profile, {
    fields: [translation.creator_id],
    references: [profile.id],
  }),
  votes: many(vote),
}));

export const vote = sqliteTable("vote", {
  ...baseColumns,
  translation_id: text().notNull().references(() => translation.id),
  polarity: text().notNull(), // "up" or "down"
  comment: text(),
  creator_id: text().notNull().references(() => profile.id),
});

export const voteRelations = relations(vote, ({ one }) => ({
  translation: one(translation, {
    fields: [vote.translation_id],
    references: [translation.id],
  }),
  creator: one(profile, {
    fields: [vote.creator_id],
    references: [profile.id],
  }),
}));

export const drizzleSchema = {
  profile,
  language,
  project,
  quest,
  tag,
  quest_tag_link,
  asset,
  asset_tag_link,
  quest_asset_link,
  translation,
  vote,
  userRelations,
  languageRelations,
  projectRelations,
  questRelations,
  tagRelations,
  quest_tag_linkRelations,
  assetRelations,
  asset_tag_linkRelations,
  quest_asset_linkRelations,
  translationRelations,
  voteRelations,
};