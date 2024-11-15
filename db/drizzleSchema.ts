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
  createdAt: text().default(timestampDefault),
  lastUpdated: text().default(timestampDefault)
};

// Additional columns for versioned tables
const versionedColumns = {
  versionChainId: text().notNull(),
  versionNum: int().notNull()
};

export const user = sqliteTable("User", {
  ...baseColumns,
  ...versionedColumns,
  username: text().notNull(),
  password: text().notNull(),
  icon: text().$type<IconName>(),
  achievements: text(),
  uiLanguageId: text()
});

export const userRelations = relations(user, ({ many, one }) => ({
  createdLanguages: many(language),
  uiLanguage: one(language, {  
    fields: [user.uiLanguageId],
    references: [language.id],
  })
}));

export const language = sqliteTable("Language", {
  ...baseColumns,
  ...versionedColumns,
  // Enforce the existence of either nativeName or englishName in the app
  nativeName: text(), // Enforce uniqueness across chains in the app
  englishName: text(), // Enforce uniqueness across chains in the app
  iso639_3: text(), // Enforce uniqueness across chains in the app
  uiReady: int({ mode: 'boolean' }).notNull(),
  creatorId: text()
});

export const languageRelations = relations(language, ({ one, many }) => ({
  creator: one(user, {
    fields: [language.creatorId],
    references: [user.id],
  }),
  uiUsers: many(user)
}));