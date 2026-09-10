import * as drizzleSchema from '@/db/drizzleSchema';
import { quest } from '@/db/drizzleSchema';
import type { System } from '@/db/powersync/system';
import type { HybridDataSource } from '@/hooks/useHybridQuery';
import type { AnyColumn, GetColumnData, SQL } from 'drizzle-orm';
import { and, eq, is, isNotNull, or } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';

const {
  quest_tag_categories: _,
  asset_tag_categories: _2,
  project_closure: _3,
  quest_closure: _4,
  quest_aggregates: _5,
  ...tablesOnly
} = drizzleSchema;

export { tablesOnly };

type TablesOnlyKeys = Exclude<keyof typeof tablesOnly, `${string}Relations`>;

/** @deprecated All writes use the single synced table. localOverride is ignored. */
export function localSourceOverrideOptions(_source: HybridDataSource) {
  return { localOverride: false as const };
}

/**
 * Returns the single SQLite table for a domain entity.
 * localOverride is ignored — unpublished work lives in the same table.
 */
export function resolveTable<T extends TablesOnlyKeys>(
  table: T,
  _options?: { localOverride?: boolean }
): (typeof drizzleSchema)[T] {
  return drizzleSchema[table];
}

/** True when a quest has not been published (draft). */
export function isUnpublishedQuest(row: {
  published_at?: string | Date | null;
}): boolean {
  return row.published_at == null;
}

/** SQLite: published quests plus the current user's drafts. */
export function publishedOrOwnQuest(userId: string | undefined) {
  return or(
    isNotNull(quest.published_at),
    userId ? eq(quest.creator_id, userId) : undefined
  );
}

/** PostgREST: published quests plus the current user's drafts. */
export function publishedOrOwnQuestFilter(userId: string | undefined): string {
  return userId
    ? `published_at.not.is.null,creator_id.eq.${userId}`
    : 'published_at.not.is.null';
}

export type WithSource<T> = T extends readonly unknown[]
  ? T[number] & { source: HybridDataSource }
  : T & { source: HybridDataSource };

export type SortOrder = 'asc' | 'desc';

export function blockedContentQuery(profileId: string, contentTable: string) {
  // Lazy import to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { system } = require('@/db/powersync/system') as { system: System };
  return system.db
    .select({ content_id: drizzleSchema.blocked_content.content_id })
    .from(drizzleSchema.blocked_content)
    .where(
      and(
        eq(drizzleSchema.blocked_content.profile_id, profileId),
        eq(drizzleSchema.blocked_content.content_table, contentTable)
      )
    );
}

export function blockedUsersQuery(profileId: string) {
  // Lazy import to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { system } = require('@/db/powersync/system') as { system: System };
  return system.db
    .select({ blocked_id: drizzleSchema.blocked_users.blocked_id })
    .from(drizzleSchema.blocked_users)
    .where(eq(drizzleSchema.blocked_users.blocker_id, profileId));
}

export const aliasedColumn = <T extends AnyColumn>(
  column: T,
  alias: string
): SQL.Aliased<GetColumnData<T>> => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  return column.getSQL().mapWith(column.mapFromDriverValue).as(alias);
};

export function toColumns(array: string[]) {
  return array.map((item) => `'${item}'`).join(', ');
}

export const resetDatabase = async () => {
  try {
    // Lazy import to avoid circular dependency

    const { system } = await import('@/db/powersync/system');

    const tableNames = Object.entries(drizzleSchema)
      .filter(([_name, obj]) => is(obj as unknown, SQLiteTable))
      .map(([name]) => name);

    console.log(`Found ${tableNames.length} tables to reset`);

    // Drop tables from our schema (SQLite doesn't have types like PostgreSQL)
    for (const tableName of tableNames) {
      await system.powersync.execute(
        `DROP TABLE IF EXISTS ps_data__${tableName}`
      );
      await system.powersync.execute(`DROP VIEW IF EXISTS ${tableName}`);
      console.log(`Dropped table: ${tableName}`);
    }

    await system.powersync.execute(`DROP TABLE IF EXISTS ps_data__attachments`);
    console.log('Dropped attachments table');

    await system.cleanup();
    await system.init();

    console.log('Database reset successfully: all tables dropped');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
};
