import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
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