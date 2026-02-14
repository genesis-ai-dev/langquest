/* eslint-disable @typescript-eslint/no-duplicate-type-constituents */
/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { OfflineDataSource } from '@/views/new/useHybridData';
import type { BuildExtraConfigColumns } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type {
  AnySQLiteColumn,
  SQLiteColumnBuilderBase,
  SQLiteTableExtraConfigValue
} from 'drizzle-orm/sqlite-core';
import {
  index,
  int,
  primaryKey,
  sqliteTableCreator,
  text
} from 'drizzle-orm/sqlite-core';
import uuid from 'react-native-uuid';
import {
  contentTypeOptions,
  matchedOnOptions,
  membershipOptions,
  reasonOptions,
  sourceOptions,
  statusOptions,
  templateOptions,
  versificationTemplateOptions
} from './constants';
import type {
  asset_local,
  language_local,
  profile_local,
  project_local,
  quest_local,
  tag_local
} from './drizzleSchemaLocal';
import type {
  asset_synced,
  language_synced,
  profile_synced,
  project_synced,
  quest_synced,
  tag_synced
} from './drizzleSchemaSynced';
import type { OpMetadata } from './powersync/opMetadata';
import { getDefaultOpMetadata } from './powersync/opMetadata';

// good types:
// export const pgBaseTable = <
//   TTableName extends string,
//   TColumnsMap extends Record<string, PgColumnBuilderBase>,
// >(
//   name: TTableName,
//   columns: TColumnsMap,
//   extraConfig?: (
//     self: BuildExtraConfigColumns<TTableName, TColumnsMap, 'pg'>,
//   ) => PgTableExtraConfigValue[],
// ) => {
//   return pgTable(
//     name,
//     {
//       id: text()
//         .$defaultFn(() => createId())
//         .primaryKey(),
//       serial: serial(),

//       ...columns,
//     },
//     (table) => [
//       index().on(table.serial),

//       ...(extraConfig ? extraConfig(table) : []),
//     ],
//   )
// }

type TableSource = OfflineDataSource | 'merged';

export const mergedTable = sqliteTableCreator((name) => name);
export const syncedTable = sqliteTableCreator((name) => `${name}_synced`);
// export const syncedTable = sqliteTableCreator((name) => name);
export const localTable = sqliteTableCreator((name) => `${name}_local`);

function getTableCreator(
  source: TableSource
): typeof localTable | typeof syncedTable | typeof mergedTable {
  return source === 'local'
    ? localTable
    : source === 'merged'
      ? mergedTable
      : syncedTable;
}

export const timestampDefault = sql`(CURRENT_TIMESTAMP)`;

const baseColumns = {
  id: text()
    .notNull()
    .$defaultFn(() => uuid.v4()),
  active: int({ mode: 'boolean' }).notNull().default(true),
  created_at: text().notNull().default(timestampDefault),
  last_updated: text()
    .notNull()
    .default(timestampDefault)
    .$onUpdate(() => timestampDefault)
};

const syncedColumns = {
  ...baseColumns,
  source: text({ enum: sourceOptions }).default('synced').notNull(),
  // _metadata is managed by PowerSync when trackMetadata: true
  // We include it in the schema so Drizzle includes it in INSERT/UPDATE statements
  // The stamp proxy in system.ts will add the value before writes
  _metadata: text({ mode: 'json' }).$type<OpMetadata>()
};

const localColumns = {
  ...baseColumns,
  source: text({ enum: sourceOptions }).default('local').notNull(),
  // We need to manually add the metadata for the local columns because you cannot simply track metadata on non-syncing tables using PowerSync.
  _metadata: text({ mode: 'json' })
    .$type<OpMetadata>()
    .$defaultFn(() => getDefaultOpMetadata())
  // draft: int({ mode: 'boolean' }).notNull().default(true)
};

export function getBaseColumns<T extends TableSource>(
  source: T
): T extends 'local'
  ? typeof localColumns
  : T extends 'merged'
    ? typeof syncedColumns & typeof localColumns
    : typeof syncedColumns {
  return (
    source === 'local'
      ? localColumns
      : source === 'merged'
        ? {
            ...syncedColumns,
            ...localColumns
          }
        : syncedColumns
  ) as T extends 'local'
    ? typeof localColumns
    : T extends 'merged'
      ? typeof syncedColumns & typeof localColumns
      : typeof syncedColumns;
}

export function getTableColumns<T extends TableSource>(source: T) {
  return {
    ...getBaseColumns(source),
    id: text()
      .primaryKey()
      .$defaultFn(() => uuid.v4())
  };
}

// ============================================================================
// METADATA TYPES - Extensible metadata for different record types
// ============================================================================

/**
 * Bible-specific metadata for quests
 * Used to identify Bible books and chapters without relying on tags
 */
export interface BibleMetadata {
  book: string; // Bible book ID (e.g., 'gen', 'matt')
  chapter?: number; // Chapter number (undefined for book-level quests)
}

/**
 * FIA-specific metadata for quests
 * Used to identify FIA books and pericopes
 */
export interface FiaMetadata {
  bookId: string; // FIA book ID (e.g., 'mrk', 'mat')
  pericopeId?: string; // FIA pericope ID (e.g., 'mrk-p1') - undefined for book-level quests
  verseRange?: string; // e.g., '1:1-13' - only set for pericope-level quests
}

/**
 * Extensible metadata type for quests
 * Can be extended with other metadata types as needed
 */
export interface QuestMetadata {
  bible?: BibleMetadata;
  fia?: FiaMetadata;
}

function normalizeParams<T>(
  params: Partial<Parameters<typeof syncedTable>[2]> | undefined,
  table: T
): SQLiteTableExtraConfigValue[] {
  // @ts-expect-error - don't know types
  const extra = (params?.(table) ?? []) as SQLiteTableExtraConfigValue[];

  return extra;
}

export function createProjectTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    language,
    profile
  }: {
    language: typeof language_synced | typeof language_local;
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'project', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'project',
    {
      ...getTableColumns(source),
      name: text().notNull(),
      description: text(),
      private: int({ mode: 'boolean' }).notNull().default(false),
      visible: int({ mode: 'boolean' }).notNull().default(true),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      template: text({ enum: templateOptions }).default('unstructured'),
      versification_template: text({
        enum: versificationTemplateOptions
      }),
      source_language_id: text(), // FK to language dropped - migrating to languoid
      target_language_id: text(), // Nullable - new projects use languoid_id via project_language_link instead
      creator_id: text().references(() => profile.id),
      priority: int().notNull().default(0),
      ...extraColumns
    },
    (table) => [
      index('name_idx').on(table.name),
      index('target_language_id_idx').on(table.target_language_id),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createProfileTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'profile', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'profile',
    {
      ...getTableColumns(source),
      email: text(),
      username: text(),
      password: text(),
      avatar: text(),
      ui_language_id: text(),
      ui_languoid_id: text(), // Reference to languoid table (server-only, not synced)
      terms_accepted: int({ mode: 'boolean' }),
      terms_accepted_at: text(),
      ...extraColumns
    },
    (table) => [...normalizeParams(extraConfig, table)]
  );

  return table;
}

export function createLanguageTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  { profile }: { profile: typeof profile_synced | typeof profile_local },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'language', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'language',
    {
      ...getTableColumns(source),
      // Enforce the existence of either native_name or english_name in the app
      native_name: text(), // Enforce uniqueness across chains in the app
      english_name: text(), // Enforce uniqueness across chains in the app
      iso639_3: text(), // Enforce uniqueness across chains in the app
      locale: text(),
      ui_ready: int({ mode: 'boolean' }).notNull(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id),
      ...extraColumns
    },
    (table) => [...normalizeParams(extraConfig, table)]
  );

  return table;
}

export function createTagTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'tag', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'tag',
    {
      ...getTableColumns(source),
      key: text().notNull(),
      value: text().notNull(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      ...extraColumns
    },
    (table) => [...normalizeParams(extraConfig, table)]
  );

  return table;
}

export function createAssetTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    language,
    project,
    profile
  }: {
    language: typeof language_synced | typeof language_local;
    project: typeof project_synced | typeof project_local;
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'asset', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'asset',
    {
      ...getTableColumns(source),
      name: text(),
      images: text({ mode: 'json' }).$type<string[]>(),
      visible: int({ mode: 'boolean' }).notNull().default(true),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      source_language_id: text(), // FK to language dropped - migrating to languoid
      project_id: text().references(() => project.id),
      source_asset_id: text().references((): AnySQLiteColumn => table.id),
      content_type: text({ enum: contentTypeOptions }).default('source'),
      creator_id: text().references(() => profile.id),
      order_index: int().notNull().default(0),
      metadata: text(), // JSON metadata for asset-specific data (e.g., verse range)
      ...extraColumns
    },
    (table) => {
      return [
        index('name_idx').on(table.name),
        index('source_language_id_idx').on(table.source_language_id),
        index('asset_source_asset_id_idx').on(table.source_asset_id),
        index('asset_project_id_idx').on(table.project_id),
        ...normalizeParams(extraConfig, table)
      ];
    }
  );

  return table;
}

export function createQuestTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    project,
    profile
  }: {
    project: typeof project_synced | typeof project_local;
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'quest', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'quest',
    {
      ...getTableColumns(source),
      name: text().notNull(),
      description: text(),
      visible: int({ mode: 'boolean' }).notNull().default(true),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      metadata: text({ mode: 'json' }).$type<QuestMetadata>(),
      project_id: text()
        .notNull()
        .references(() => project.id),
      parent_id: text().references((): AnySQLiteColumn => table.id),
      creator_id: text().references(() => profile.id),
      ...extraColumns
    },
    (table) => {
      return [
        index('project_id_idx').on(table.project_id),
        index('parent_id_idx').on(table.parent_id),
        index('name_idx').on(table.name),
        ...normalizeParams(extraConfig, table)
      ];
    }
  );

  return table;
}

export function createVoteTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    asset,
    profile
  }: {
    asset: typeof asset_synced | typeof asset_local;
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'vote', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'vote',
    {
      ...getTableColumns(source),
      polarity: text({ enum: ['up', 'down'] }).notNull(),
      comment: text(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      asset_id: text()
        .notNull()
        .references(() => asset.id),
      creator_id: text()
        .notNull()
        .references(() => profile.id),
      ...extraColumns
    },
    (table) => {
      return [
        index('asset_id_idx').on(table.asset_id),
        index('creator_id_idx').on(table.creator_id),
        ...normalizeParams(extraConfig, table)
      ];
    }
  );

  return table;
}

export function createReportsTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  { profile }: { profile: typeof profile_synced | typeof profile_local },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'reports', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'reports',
    {
      ...getTableColumns(source),
      record_id: text().notNull(),
      record_table: text().notNull(),
      reason: text({ enum: reasonOptions }).notNull(),
      details: text(),
      reporter_id: text()
        .notNull()
        .references(() => profile.id),
      ...extraColumns
    },
    (table) => {
      return [
        index('record_id_record_table_idx').on(
          table.record_id,
          table.record_table
        ),
        index('reporter_id_idx').on(table.reporter_id),
        ...normalizeParams(extraConfig, table)
      ];
    }
  );

  return table;
}

export function createBlockedUsersTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  { profile }: { profile: typeof profile_synced | typeof profile_local },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'blocked_users', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'blocked_users',
    {
      ...getBaseColumns(source),
      blocker_id: text()
        .notNull()
        .references(() => profile.id),
      blocked_id: text()
        .notNull()
        .references(() => profile.id),
      ...extraColumns
    },
    (table) => [
      primaryKey({ columns: [table.blocker_id, table.blocked_id] }),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createBlockedContentTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  { profile }: { profile: typeof profile_synced | typeof profile_local },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'blocked_content', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'blocked_content',
    {
      ...getTableColumns(source),
      content_id: text().notNull(),
      content_table: text().notNull(),
      profile_id: text()
        .notNull()
        .references(() => profile.id),
      ...extraColumns
    },
    (table) => [
      index('profile_id_idx').on(table.profile_id),
      index('content_id_content_table_idx').on(
        table.content_id,
        table.content_table
      ),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createAssetContentLinkTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    asset,
    language
  }: {
    asset: typeof asset_synced | typeof asset_local;
    language: typeof language_synced | typeof language_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'asset_content_link', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'asset_content_link',
    {
      ...getTableColumns(source),
      text: text(),
      audio: text({ mode: 'json' }).$type<string[]>(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      asset_id: text()
        .notNull()
        .references(() => asset.id),
      source_language_id: text(), // FK to language dropped - migrating to languoid
      languoid_id: text(), // Reference to languoid table
      ...extraColumns
    },
    (table) => {
      return [
        index('asset_id_idx').on(table.asset_id),
        index('asset_content_link_source_language_id_idx').on(
          table.source_language_id
        ),
        ...normalizeParams(extraConfig, table)
      ];
    }
  );

  return table;
}

export function createProjectLanguageLinkTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    project,
    language
  }: {
    project: typeof project_synced | typeof project_local;
    language: typeof language_synced | typeof language_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<
      'project_language_link',
      TColumnsMap,
      'sqlite'
    >
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'project_language_link',
    {
      ...getBaseColumns(source),
      language_type: text({ enum: ['source', 'target'] }).notNull(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      project_id: text()
        .notNull()
        .references(() => project.id),
      language_id: text(), // Nullable - kept for backward compatibility
      languoid_id: text().notNull(), // Part of new PK - canonical language reference
      ...extraColumns
    },
    (table) => [
      primaryKey({
        columns: [table.project_id, table.languoid_id, table.language_type]
      }),
      index('pll_project_id_idx').on(table.project_id),
      index('pll_language_type_idx').on(table.language_type),
      index('pll_language_id_idx').on(table.language_id), // For backward compatibility
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createQuestTagLinkTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    quest,
    tag
  }: {
    quest: typeof quest_synced | typeof quest_local;
    tag: typeof tag_synced | typeof tag_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'quest_tag_link', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'quest_tag_link',
    {
      ...getBaseColumns(source),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      quest_id: text()
        .notNull()
        .references(() => quest.id),
      tag_id: text()
        .notNull()
        .references(() => tag.id),
      ...extraColumns
    },
    (table) => [
      primaryKey({ columns: [table.quest_id, table.tag_id] }),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createAssetTagLinkTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    asset,
    tag
  }: {
    asset: typeof asset_synced | typeof asset_local;
    tag: typeof tag_synced | typeof tag_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'asset_tag_link', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'asset_tag_link',
    {
      ...getBaseColumns(source),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      asset_id: text()
        .notNull()
        .references(() => asset.id),
      tag_id: text()
        .notNull()
        .references(() => tag.id),
      ...extraColumns
    },
    (table) => [
      primaryKey({ columns: [table.asset_id, table.tag_id] }),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createQuestAssetLinkTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    quest,
    asset
  }: {
    quest: typeof quest_synced | typeof quest_local;
    asset: typeof asset_synced | typeof asset_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'quest_asset_link', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'quest_asset_link',
    {
      ...getBaseColumns(source),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      visible: int({ mode: 'boolean' }).notNull().default(true),
      quest_id: text()
        .notNull()
        .references(() => quest.id),
      asset_id: text()
        .notNull()
        .references(() => asset.id),
      ...extraColumns
    },
    (table) => [
      primaryKey({ columns: [table.quest_id, table.asset_id] }),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createNotificationTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    profile
  }: {
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'notification', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'notification',
    {
      ...getTableColumns(source),
      viewed: int({ mode: 'boolean' }).notNull().default(false),
      target_table_name: text().notNull(),
      target_record_id: text().notNull(),
      profile_id: text()
        .notNull()
        .references(() => profile.id),
      ...extraColumns
    },
    (table) => [...normalizeParams(extraConfig, table)]
  );

  return table;
}

export function createInviteTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    senderProfile,
    receiverProfile,
    project
  }: {
    senderProfile: typeof profile_synced | typeof profile_local;
    receiverProfile: typeof profile_synced | typeof profile_local;
    project: typeof project_synced | typeof project_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'invite', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'invite',
    {
      ...getTableColumns(source),
      status: text({ enum: statusOptions }).notNull(),
      as_owner: int({ mode: 'boolean' }).notNull().default(false),
      email: text().notNull(),
      count: int().notNull(),
      sender_profile_id: text()
        .notNull()
        .references(() => senderProfile.id),
      receiver_profile_id: text().references(() => receiverProfile.id),
      project_id: text()
        .notNull()
        .references(() => project.id),
      ...extraColumns
    },
    (table) => [
      index('idx_invite_request_receiver_email').on(table.email),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createProfileProjectLinkTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    profile,
    project
  }: {
    profile: typeof profile_synced | typeof profile_local;
    project: typeof project_synced | typeof project_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'profile_project_link', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'profile_project_link',
    {
      ...getBaseColumns(source),
      membership: text({ enum: membershipOptions }).default('member').notNull(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      profile_id: text()
        .notNull()
        .references(() => profile.id),
      project_id: text()
        .notNull()
        .references(() => project.id),
      ...extraColumns
    },
    (table) => [
      primaryKey({ columns: [table.profile_id, table.project_id] }),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createRequestTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    senderProfile,
    project
  }: {
    senderProfile: typeof profile_synced | typeof profile_local;
    project: typeof project_synced | typeof project_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'request', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'request',
    {
      ...getTableColumns(source),
      status: text({ enum: statusOptions }).notNull(),
      count: int().notNull(),
      sender_profile_id: text()
        .notNull()
        .references(() => senderProfile.id),
      project_id: text()
        .notNull()
        .references(() => project.id),
      ...extraColumns
    },
    (table) => [...normalizeParams(extraConfig, table)]
  );

  return table;
}

export function createSubscriptionTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    profile
  }: {
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'subscription', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'subscription',
    {
      ...getTableColumns(source),
      target_record_id: text().notNull(),
      target_table_name: text().notNull(),
      profile_id: text()
        .notNull()
        .references(() => profile.id),
      ...extraColumns
    },
    (table) => [...normalizeParams(extraConfig, table)]
  );

  return table;
}

export function createQuestClosureTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    quest,
    project
  }: {
    quest: typeof quest_synced | typeof quest_local;
    project: typeof project_synced | typeof project_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'quest_closure', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'quest_closure',
    {
      quest_id: text()
        .primaryKey()
        .references(() => quest.id),
      project_id: text()
        .notNull()
        .references(() => project.id),
      // ID Arrays (for bulk downloads)
      asset_ids: text({ mode: 'json' }).$type<string[]>().default([]),
      translation_ids: text({ mode: 'json' }).$type<string[]>().default([]),
      vote_ids: text({ mode: 'json' }).$type<string[]>().default([]),
      tag_ids: text({ mode: 'json' }).$type<string[]>().default([]),
      language_ids: text({ mode: 'json' }).$type<string[]>().default([]),
      quest_asset_link_ids: text({ mode: 'json' })
        .$type<string[]>()
        .default([]),
      asset_content_link_ids: text({ mode: 'json' })
        .$type<string[]>()
        .default([]),
      quest_tag_link_ids: text({ mode: 'json' }).$type<string[]>().default([]),
      asset_tag_link_ids: text({ mode: 'json' }).$type<string[]>().default([]),

      // Computed Aggregates (for progress display)
      total_assets: int().notNull().default(0),
      total_translations: int().notNull().default(0),
      approved_translations: int().notNull().default(0),

      // Download tracking
      download_profiles: text({ mode: 'json' }).$type<string[]>().default([]),

      last_updated: text().notNull().default(timestampDefault),
      ...extraColumns
    },
    (table) => [
      index('quest_closure_project_id_idx').on(table.project_id),
      index('quest_closure_last_updated_idx').on(table.last_updated),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createProjectClosureTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    project
  }: {
    project: typeof project_synced | typeof project_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'project_closure', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'project_closure',
    {
      // ID Arrays (for bulk downloads - aggregated from all quest closures)
      asset_ids: text({ mode: 'json' }).$type<string[]>().default([]),
      translation_ids: text({ mode: 'json' }).$type<string[]>().default([]),
      vote_ids: text({ mode: 'json' }).$type<string[]>().default([]),
      tag_ids: text({ mode: 'json' }).$type<string[]>().default([]),
      language_ids: text({ mode: 'json' }).$type<string[]>().default([]),
      quest_ids: text({ mode: 'json' }).$type<string[]>().default([]),
      quest_asset_link_ids: text({ mode: 'json' })
        .$type<string[]>()
        .default([]),
      asset_content_link_ids: text({ mode: 'json' })
        .$type<string[]>()
        .default([]),
      quest_tag_link_ids: text({ mode: 'json' }).$type<string[]>().default([]),
      asset_tag_link_ids: text({ mode: 'json' }).$type<string[]>().default([]),

      // Computed Aggregates (for progress display)
      total_quests: int().notNull().default(0),
      total_assets: int().notNull().default(0),
      total_translations: int().notNull().default(0),
      approved_translations: int().notNull().default(0),

      // Download tracking
      download_profiles: text({ mode: 'json' }).$type<string[]>().default([]),

      last_updated: text().notNull().default(timestampDefault),
      project_id: text()
        .primaryKey()
        .references(() => project.id),
      ...extraColumns
    },
    (table) => [
      index('project_closure_last_updated_idx').on(table.last_updated),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

// ============================================================================
// LANGUOID TABLE DEFINITIONS
// ============================================================================

export function createLanguoidTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  { profile }: { profile: typeof profile_synced | typeof profile_local },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'languoid', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'languoid',
    {
      ...getTableColumns(source),
      name: text(),
      parent_id: text().references((): AnySQLiteColumn => table.id),
      level: text({ enum: ['family', 'language', 'dialect'] }).notNull(),
      ui_ready: int({ mode: 'boolean' }).notNull().default(false),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id),
      ...extraColumns
    },
    (table) => [
      index('languoid_parent_id_idx').on(table.parent_id),
      index('languoid_name_idx').on(table.name),
      index('languoid_ui_ready_idx').on(table.ui_ready),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createLanguoidAliasTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    languoid,
    profile
  }: {
    languoid: { id: AnySQLiteColumn };
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'languoid_alias', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'languoid_alias',
    {
      ...getTableColumns(source),
      subject_languoid_id: text()
        .notNull()
        .references(() => languoid.id),
      label_languoid_id: text()
        .notNull()
        .references(() => languoid.id),
      name: text().notNull(),
      alias_type: text({ enum: ['endonym', 'exonym'] }).notNull(),
      source_names: text({ mode: 'json' }).$type<string[]>().default([]),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id),
      ...extraColumns
    },
    (table) => [
      index('languoid_alias_subject_idx').on(table.subject_languoid_id),
      index('languoid_alias_label_idx').on(table.label_languoid_id),
      index('languoid_alias_name_idx').on(table.name),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createLanguoidSourceTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    languoid,
    profile
  }: {
    languoid: { id: AnySQLiteColumn };
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'languoid_source', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'languoid_source',
    {
      ...getTableColumns(source),
      name: text().notNull(),
      version: text(),
      languoid_id: text()
        .notNull()
        .references(() => languoid.id),
      unique_identifier: text(),
      url: text(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id),
      ...extraColumns
    },
    (table) => [
      index('languoid_source_languoid_id_idx').on(table.languoid_id),
      index('languoid_source_unique_identifier_idx').on(
        table.unique_identifier
      ),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createLanguoidPropertyTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    languoid,
    profile
  }: {
    languoid: { id: AnySQLiteColumn };
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'languoid_property', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'languoid_property',
    {
      ...getTableColumns(source),
      languoid_id: text()
        .notNull()
        .references(() => languoid.id),
      key: text().notNull(),
      value: text().notNull(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id),
      ...extraColumns
    },
    (table) => [
      index('languoid_property_languoid_id_idx').on(table.languoid_id),
      index('languoid_property_key_idx').on(table.key),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createRegionTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  { profile }: { profile: typeof profile_synced | typeof profile_local },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'region', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'region',
    {
      ...getTableColumns(source),
      name: text(),
      parent_id: text().references((): AnySQLiteColumn => table.id),
      level: text({ enum: ['continent', 'nation', 'subnational'] }).notNull(),
      geometry: int({ mode: 'boolean' }).notNull().default(false),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id),
      ...extraColumns
    },
    (table) => [
      index('region_parent_id_idx').on(table.parent_id),
      index('region_name_idx').on(table.name),
      index('region_level_idx').on(table.level),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createRegionAliasTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    region,
    languoid,
    profile
  }: {
    region: { id: AnySQLiteColumn };
    languoid: { id: AnySQLiteColumn };
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'region_alias', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'region_alias',
    {
      ...getTableColumns(source),
      subject_region_id: text()
        .notNull()
        .references(() => region.id),
      label_languoid_id: text()
        .notNull()
        .references(() => languoid.id),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id),
      ...extraColumns
    },
    (table) => [
      index('region_alias_subject_idx').on(table.subject_region_id),
      index('region_alias_label_idx').on(table.label_languoid_id),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createRegionSourceTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    region,
    profile
  }: {
    region: { id: AnySQLiteColumn };
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'region_source', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'region_source',
    {
      ...getTableColumns(source),
      name: text().notNull(),
      version: text(),
      region_id: text()
        .notNull()
        .references(() => region.id),
      unique_identifier: text(),
      url: text(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id),
      ...extraColumns
    },
    (table) => [
      index('region_source_region_id_idx').on(table.region_id),
      index('region_source_unique_identifier_idx').on(table.unique_identifier),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createRegionPropertyTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    region,
    profile
  }: {
    region: { id: AnySQLiteColumn };
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'region_property', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'region_property',
    {
      ...getTableColumns(source),
      region_id: text()
        .notNull()
        .references(() => region.id),
      key: text().notNull(),
      value: text().notNull(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id),
      ...extraColumns
    },
    (table) => [
      index('region_property_region_id_idx').on(table.region_id),
      index('region_property_key_idx').on(table.key),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createLanguoidRegionTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    languoid,
    region,
    profile
  }: {
    languoid: { id: AnySQLiteColumn };
    region: { id: AnySQLiteColumn };
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<'languoid_region', TColumnsMap, 'sqlite'>
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'languoid_region',
    {
      ...getTableColumns(source),
      languoid_id: text()
        .notNull()
        .references(() => languoid.id),
      region_id: text()
        .notNull()
        .references(() => region.id),
      majority: int({ mode: 'boolean' }),
      official: int({ mode: 'boolean' }),
      native: int({ mode: 'boolean' }),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id),
      ...extraColumns
    },
    (table) => [
      index('languoid_region_languoid_id_idx').on(table.languoid_id),
      index('languoid_region_region_id_idx').on(table.region_id),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

// Note: statusOptions and matchedOnOptions are imported from constants.ts at the top of the file

export function createLanguoidLinkSuggestionTable<
  T extends TableSource,
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase> = {}
>(
  source: T,
  {
    languoid,
    profile
  }: {
    languoid: { id: AnySQLiteColumn };
    profile: typeof profile_synced | typeof profile_local;
  },
  columns?: TColumnsMap,
  extraConfig?: (
    self: BuildExtraConfigColumns<
      'languoid_link_suggestion',
      TColumnsMap,
      'sqlite'
    >
  ) => SQLiteTableExtraConfigValue[]
) {
  const extraColumns = (columns ?? {}) as TColumnsMap;
  const table = getTableCreator(source)(
    'languoid_link_suggestion',
    {
      ...getTableColumns(source),
      // The user-created languoid that needs linking
      languoid_id: text()
        .notNull()
        .references(() => languoid.id),
      // The suggested existing languoid to link to
      suggested_languoid_id: text()
        .notNull()
        .references(() => languoid.id),
      // The user who created the custom languoid (receives the notification)
      profile_id: text()
        .notNull()
        .references(() => profile.id),
      // Match quality: 1=exact, 2=starts-with, 3=contains
      match_rank: int().notNull().default(3),
      // What the match was based on: name, alias, or iso_code
      matched_on: text({ enum: matchedOnOptions }),
      // The actual value that matched
      matched_value: text(),
      status: text({ enum: statusOptions }).notNull().default('pending'),
      ...extraColumns
    },
    (table) => [
      index('languoid_link_suggestion_user_languoid_idx').on(table.languoid_id),
      index('languoid_link_suggestion_creator_idx').on(table.profile_id),
      index('languoid_link_suggestion_status_idx').on(table.status),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}
