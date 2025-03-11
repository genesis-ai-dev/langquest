import { sqliteTable, AnySQLiteColumn } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

export const drizzleMigrations = sqliteTable("__drizzle_migrations", {
});

