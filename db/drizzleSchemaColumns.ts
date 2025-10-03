/* eslint-disable @typescript-eslint/no-duplicate-type-constituents */
import type { OfflineQuerySource } from '@/utils/dbUtils';
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

type TableSource = OfflineQuerySource | 'merged';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OmitFirstParameter<T extends (...args: any) => any> = T extends (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  firstArg: any,
  ...restArgs: infer P
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => any
  ? P
  : never;

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

export const uuidDefault = sql`(lower(hex(randomblob(16))))`;
export const timestampDefault = sql`(CURRENT_TIMESTAMP)`;

const baseColumns = {
  id: text().notNull(),
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
  source: text({ enum: sourceOptions }).default('local').notNull(),
  draft: int({ mode: 'boolean' }).notNull().default(true)
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
      .$defaultFn(() => uuidDefault)
  };
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
  TColumnsMap extends Record<string, SQLiteColumnBuilderBase>,
  T extends TableSource
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
      target_language_id: text()
        .notNull()
        .references(() => language.id),
      creator_id: text().references(() => profile.id),
      ...columns
    },
    (table) => [
      index('name_idx').on(table.name),
      index('target_language_id_idx').on(table.target_language_id),
      ...normalizeParams(extraConfig, table)
    ]
  );

  return table;
}

export function createProfileTable<T extends TableSource>(
  source: T,
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => [...normalizeParams(params[1], table)]
  );

  return table;
}

export function createLanguageTable<T extends TableSource>(
  source: T,
  { profile }: { profile: typeof profile_synced | typeof profile_local },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => [...normalizeParams(params[1], table)]
  );

  return table;
}

export function createTagTable<T extends TableSource>(
  source: T,
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
  const table = getTableCreator(source)(
    'tag',
    {
      ...getTableColumns(source),
      key: text().notNull(),
      value: text().notNull(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      ...params[0]
    },
    (table) => [...normalizeParams(params[1], table)]
  );

  return table;
}

export function createAssetTable<T extends TableSource>(
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
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
  const table = getTableCreator(source)(
    'asset',
    {
      ...getTableColumns(source),
      name: text().notNull(),
      images: text({ mode: 'json' }).$type<string[]>(),
      visible: int({ mode: 'boolean' }).notNull().default(true),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      source_language_id: text()
        .notNull()
        .references(() => language.id),
      project_id: text().references(() => project.id),
      source_asset_id: text().references((): AnySQLiteColumn => table.id),
      creator_id: text().references(() => profile.id),
      ...params[0]
    },
    (table) => {
      return [
        index('name_idx').on(table.name),
        index('source_language_id_idx').on(table.source_language_id),
        index('asset_source_asset_id_idx').on(table.source_asset_id),
        index('asset_project_id_idx').on(table.project_id),
        ...normalizeParams(params[1], table)
      ];
    }
  );

  return table;
}

export function createQuestTable<T extends TableSource>(
  source: T,
  {
    project,
    profile
  }: {
    project: typeof project_synced | typeof project_local;
    profile: typeof profile_synced | typeof profile_local;
  },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
  const table = getTableCreator(source)(
    'quest',
    {
      ...getTableColumns(source),
      name: text().notNull(),
      description: text(),
      visible: int({ mode: 'boolean' }).notNull().default(true),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      project_id: text()
        .notNull()
        .references(() => project.id),
      parent_id: text().references((): AnySQLiteColumn => table.id),
      creator_id: text().references(() => profile.id),
      ...params[0]
    },
    (table) => {
      return [
        index('project_id_idx').on(table.project_id),
        index('parent_id_idx').on(table.parent_id),
        index('name_idx').on(table.name),
        ...normalizeParams(params[1], table)
      ];
    }
  );

  return table;
}

export function createVoteTable<T extends TableSource>(
  source: T,
  {
    asset,
    profile
  }: {
    asset: typeof asset_synced | typeof asset_local;
    profile: typeof profile_synced | typeof profile_local;
  },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[1]
    },
    (table) => {
      // @ts-expect-error - don't know types
      const extra = (params[2]?.(table) ?? []) as SQLiteTableExtraConfigValue[];
      return [
        index('asset_id_idx').on(table.asset_id),
        index('creator_id_idx').on(table.creator_id),
        ...extra
      ];
    }
  );

  return table;
}

export function createReportsTable<T extends TableSource>(
  source: T,
  { profile }: { profile: typeof profile_synced | typeof profile_local },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => {
      return [
        index('record_id_record_table_idx').on(
          table.record_id,
          table.record_table
        ),
        index('reporter_id_idx').on(table.reporter_id),
        ...normalizeParams(params[1], table)
      ];
    }
  );

  return table;
}

export function createBlockedUsersTable<T extends TableSource>(
  source: T,
  { profile }: { profile: typeof profile_synced | typeof profile_local },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => [
      primaryKey({ columns: [table.blocker_id, table.blocked_id] }),
      ...normalizeParams(params[1], table)
    ]
  );

  return table;
}

export function createBlockedContentTable<T extends TableSource>(
  source: T,
  { profile }: { profile: typeof profile_synced | typeof profile_local },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
  const table = getTableCreator(source)(
    'blocked_content',
    {
      ...getTableColumns(source),
      content_id: text().notNull(),
      content_table: text().notNull(),
      profile_id: text()
        .notNull()
        .references(() => profile.id),
      ...params[0]
    },
    (table) => [
      index('profile_id_idx').on(table.profile_id),
      index('content_id_content_table_idx').on(
        table.content_id,
        table.content_table
      ),
      ...normalizeParams(params[1], table)
    ]
  );

  return table;
}

export function createAssetContentLinkTable<T extends TableSource>(
  source: T,
  {
    asset,
    language
  }: {
    asset: typeof asset_synced | typeof asset_local;
    language: typeof language_synced | typeof language_local;
  },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => {
      return [
        index('asset_id_idx').on(table.asset_id),
        index('asset_content_link_source_language_id_idx').on(
          table.source_language_id
        ),
        ...normalizeParams(params[1], table)
      ];
    }
  );

  return table;
}

export function createProjectLanguageLinkTable<T extends TableSource>(
  source: T,
  {
    project,
    language
  }: {
    project: typeof project_synced | typeof project_local;
    language: typeof language_synced | typeof language_local;
  },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => [
      primaryKey({
        columns: [table.project_id, table.language_id, table.language_type]
      }),
      index('pll_project_id_idx').on(table.project_id),
      index('pll_language_type_idx').on(table.language_type),
      ...normalizeParams(params[1], table)
    ]
  );

  return table;
}

export function createQuestTagLinkTable<T extends TableSource>(
  source: T,
  {
    quest,
    tag
  }: {
    quest: typeof quest_synced | typeof quest_local;
    tag: typeof tag_synced | typeof tag_local;
  },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => [
      primaryKey({ columns: [table.quest_id, table.tag_id] }),
      ...normalizeParams(params[1], table)
    ]
  );

  return table;
}

export function createAssetTagLinkTable<T extends TableSource>(
  source: T,
  {
    asset,
    tag
  }: {
    asset: typeof asset_synced | typeof asset_local;
    tag: typeof tag_synced | typeof tag_local;
  },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => [
      primaryKey({ columns: [table.asset_id, table.tag_id] }),
      ...normalizeParams(params[1], table)
    ]
  );

  return table;
}

export function createQuestAssetLinkTable<T extends TableSource>(
  source: T,
  {
    quest,
    asset
  }: {
    quest: typeof quest_synced | typeof quest_local;
    asset: typeof asset_synced | typeof asset_local;
  },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => [
      primaryKey({ columns: [table.quest_id, table.asset_id] }),
      ...normalizeParams(params[1], table)
    ]
  );

  return table;
}

export function createNotificationTable<T extends TableSource>(
  source: T,
  {
    profile
  }: {
    profile: typeof profile_synced | typeof profile_local;
  },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => [...normalizeParams(params[1], table)]
  );

  return table;
}

export function createInviteTable<T extends TableSource>(
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
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => [
      index('idx_invite_request_receiver_email').on(table.email),
      ...normalizeParams(params[1], table)
    ]
  );

  return table;
}

export function createProfileProjectLinkTable<T extends TableSource>(
  source: T,
  {
    profile,
    project
  }: {
    profile: typeof profile_synced | typeof profile_local;
    project: typeof project_synced | typeof project_local;
  },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => [
      primaryKey({ columns: [table.profile_id, table.project_id] }),
      ...normalizeParams(params[1], table)
    ]
  );

  return table;
}

export function createRequestTable<T extends TableSource>(
  source: T,
  {
    senderProfile,
    project
  }: {
    senderProfile: typeof profile_synced | typeof profile_local;
    project: typeof project_synced | typeof project_local;
  },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => [...normalizeParams(params[1], table)]
  );

  return table;
}

export function createSubscriptionTable<T extends TableSource>(
  source: T,
  {
    profile
  }: {
    profile: typeof profile_synced | typeof profile_local;
  },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
  const table = getTableCreator(source)(
    'subscription',
    {
      ...getTableColumns(source),
      target_record_id: text().notNull(),
      target_table_name: text().notNull(),
      profile_id: text()
        .notNull()
        .references(() => profile.id),
      ...params[0]
    },
    (table) => [...normalizeParams(params[1], table)]
  );

  return table;
}

export function createQuestClosureTable<T extends TableSource>(
  source: T,
  {
    quest,
    project
  }: {
    quest: typeof quest_synced | typeof quest_local;
    project: typeof project_synced | typeof project_local;
  },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => [
      index('quest_closure_project_id_idx').on(table.project_id),
      index('quest_closure_last_updated_idx').on(table.last_updated),
      ...normalizeParams(params[1], table)
    ]
  );

  return table;
}

export function createProjectClosureTable<T extends TableSource>(
  source: T,
  {
    project
  }: {
    project: typeof project_synced | typeof project_local;
  },
  ...params: Partial<OmitFirstParameter<typeof syncedTable>>
) {
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
      ...params[0]
    },
    (table) => [
      index('project_closure_last_updated_idx').on(table.last_updated),
      ...normalizeParams(params[1], table)
    ]
  );

  return table;
}
