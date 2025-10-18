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
  membershipOptions,
  reasonOptions,
  sourceOptions,
  statusOptions,
  templateOptions
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
  source: text({ enum: sourceOptions }).default('synced').notNull()
};

const localColumns = {
  ...baseColumns,
  source: text({ enum: sourceOptions }).default('local').notNull()
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
 * Extensible metadata type for quests
 * Can be extended with other metadata types as needed
 */
export interface QuestMetadata {
  bible?: BibleMetadata;
  // Add other metadata types here as needed
  // e.g., curriculum?: { unit: string; lesson: number };
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
      source_language_id: text().references(() => language.id),
      target_language_id: text()
        .notNull()
        .references(() => language.id),
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
      source_language_id: text()
        // .notNull() TODO: make decision about this
        .references(() => language.id),
      project_id: text().references(() => project.id),
      source_asset_id: text().references((): AnySQLiteColumn => table.id),
      creator_id: text().references(() => profile.id),
      order_index: int().notNull().default(0),
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
      source_language_id: text().references(() => language.id),
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
      language_id: text()
        .notNull()
        .references(() => language.id),
      ...extraColumns
    },
    (table) => [
      primaryKey({
        columns: [table.project_id, table.language_id, table.language_type]
      }),
      index('pll_project_id_idx').on(table.project_id),
      index('pll_language_type_idx').on(table.language_type),
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
