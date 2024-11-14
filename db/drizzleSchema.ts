import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

// Create a type from your actual icon files
type IconName = `${string}.png`;  // Matches any .png filename

const uuidDefault = sql`(lower(hex(randomblob(16))))`;
const timestampDefault = sql`CURRENT_TIMESTAMP`;

export const user = sqliteTable("User", {
  id: text().primaryKey().$defaultFn(() => uuidDefault),
  rev: int().notNull(),
  username: text().notNull(),
  password: text().notNull(),
  icon: text().$type<IconName>(),
  versionChainId: text().notNull(),
  versionNum: int().notNull(),
  //createdLanguages
  achievements: text(),
  createdAt: text().default(timestampDefault),
  lastUpdated: text().default(timestampDefault)
});

export const userRelations = relations(user, ({ many }) => ({
  createdLanguages: many(language)  // Simplified version
}));

export const language = sqliteTable("Language", {
  id: text().primaryKey().$defaultFn(() => uuidDefault),
  rev: int().notNull(),
  // Enforce the existence of either nativeName or englishName in the app
  nativeName: text(), // Enforce uniqueness across chains in the app
  englishName: text(), // Enforce uniqueness across chains in the app
  iso639_3: text(), // Enforce uniqueness across chains in the app
  versionChainId: text().notNull(),
  versionNum: int().notNull(), // Ensure version num unique within chain in the app
  uiReady: int({ mode: 'boolean' }).notNull(),
  creatorId: text(),
  createdAt: text().default(timestampDefault),
  lastUpdated: text().default(timestampDefault)
});

export const languageRelations = relations(language, ({ one }) => ({
  creator: one(user, {
    fields: [language.creatorId],
    references: [user.id],
  })
}));