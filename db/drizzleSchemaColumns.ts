import { sql } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import {
  index,
  int,
  primaryKey,
  sqliteTable,
  text
} from 'drizzle-orm/sqlite-core';
import uuid from 'react-native-uuid';
import {
  contentTypeOptions,
  emailStatusOptions,
  inviteBounceReasonOptions,
  inviteBounceTypeOptions,
  matchedOnOptions,
  membershipOptions,
  reasonOptions,
  requestTypeOptions,
  statusOptions,
  templateOptions,
  versificationTemplateOptions
} from './constants';
import type { OpMetadata } from './powersync/opMetadata';

type TableRef = { id: AnySQLiteColumn };

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

const tableColumns = {
  ...baseColumns,
  // _metadata is managed by PowerSync when trackMetadata: true
  _metadata: text({ mode: 'json' }).$type<OpMetadata>()
};

export function getBaseColumns() {
  return tableColumns;
}

export function getTableColumns() {
  return {
    ...getBaseColumns(),
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

export interface RecordingSessionMetadata {
  id: string;
  created_at: string;
}
/**
 * Extensible metadata type for quests
 * Can be extended with other metadata types as needed
 */
export interface QuestMetadata {
  bible?: BibleMetadata;
  fia?: FiaMetadata;
  /** Local version disambiguator (e.g. '#1') for multiple copies of the same chapter/pericope. */
  versionLabel?: string;
  lastRecordingSessionId?: string;
  recordingSessions?: RecordingSessionMetadata[];
  /** When true, this quest can receive imported assets (Bible chapter / FIA pericope). */
  allowImportAssets?: boolean;
  // Add other metadata types here as needed
  // e.g., curriculum?: { unit: string; lesson: number };
}

export function createProjectTable({
  language,
  profile
}: {
  language: TableRef;
  profile: TableRef;
}) {
  const table = sqliteTable(
    'project',
    {
      ...getTableColumns(),
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
      uploaded_at: text() // Nullable - set by server trigger when content is uploaded
    },
    (table) => [
      index('name_idx').on(table.name),
      index('target_language_id_idx').on(table.target_language_id)
    ]
  );

  return table;
}

export function createProfileTable() {
  const table = sqliteTable('profile', {
    ...getTableColumns(),
    email: text(),
    username: text(),
    password: text(),
    avatar: text(),
    ui_language_id: text(),
    ui_languoid_id: text(), // Reference to languoid table (server-only, not synced)
    terms_accepted: int({ mode: 'boolean' }),
    terms_accepted_at: text()
  });

  return table;
}

export function createLanguageTable({ profile }: { profile: TableRef }) {
  const table = sqliteTable('language', {
    ...getTableColumns(),
    // Enforce the existence of either native_name or english_name in the app
    native_name: text(), // Enforce uniqueness across chains in the app
    english_name: text(), // Enforce uniqueness across chains in the app
    iso639_3: text(), // Enforce uniqueness across chains in the app
    locale: text(),
    ui_ready: int({ mode: 'boolean' }).notNull(),
    download_profiles: text({ mode: 'json' }).$type<string[]>(),
    creator_id: text().references(() => profile.id)
  });

  return table;
}

export function createTagTable() {
  const table = sqliteTable('tag', {
    ...getTableColumns(),
    key: text().notNull(),
    value: text().notNull(),
    download_profiles: text({ mode: 'json' }).$type<string[]>()
  });

  return table;
}

export function createAssetTable({
  language,
  project,
  profile
}: {
  language: TableRef;
  project: TableRef;
  profile: TableRef;
}) {
  const table = sqliteTable(
    'asset',
    {
      ...getTableColumns(),
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
      uploaded_at: text() // Nullable - set by server trigger when content is uploaded
    },
    (table) => {
      return [
        index('name_idx').on(table.name),
        index('source_language_id_idx').on(table.source_language_id),
        index('asset_source_asset_id_idx').on(table.source_asset_id),
        index('asset_project_id_idx').on(table.project_id)
      ];
    }
  );

  return table;
}

export function createQuestTable({
  project,
  profile
}: {
  project: TableRef;
  profile: TableRef;
}) {
  const table = sqliteTable(
    'quest',
    {
      ...getTableColumns(),
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
      uploaded_at: text(), // Nullable - set by server trigger when content is uploaded
      published_at: text() // Null until the creator publishes; others cannot see the quest
    },
    (table) => {
      return [
        index('project_id_idx').on(table.project_id),
        index('parent_id_idx').on(table.parent_id),
        index('name_idx').on(table.name),
        index('quest_published_at_idx').on(table.published_at)
      ];
    }
  );

  return table;
}

export function createVoteTable({
  asset,
  profile
}: {
  asset: TableRef;
  profile: TableRef;
}) {
  const table = sqliteTable(
    'vote',
    {
      ...getTableColumns(),
      polarity: text({ enum: ['up', 'down'] }).notNull(),
      comment: text(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      asset_id: text()
        .notNull()
        .references(() => asset.id),
      creator_id: text()
        .notNull()
        .references(() => profile.id),
      uploaded_at: text() // Nullable - set by server trigger when content is uploaded
    },
    (table) => {
      return [
        index('asset_id_idx').on(table.asset_id),
        index('creator_id_idx').on(table.creator_id)
      ];
    }
  );

  return table;
}

export function createReportsTable({ profile }: { profile: TableRef }) {
  const table = sqliteTable(
    'reports',
    {
      ...getTableColumns(),
      record_id: text().notNull(),
      record_table: text().notNull(),
      reason: text({ enum: reasonOptions }).notNull(),
      details: text(),
      reporter_id: text()
        .notNull()
        .references(() => profile.id)
    },
    (table) => {
      return [
        index('record_id_record_table_idx').on(
          table.record_id,
          table.record_table
        ),
        index('reporter_id_idx').on(table.reporter_id)
      ];
    }
  );

  return table;
}

export function createFeedbackTable({ profile }: { profile: TableRef }) {
  const table = sqliteTable(
    'feedback',
    {
      // Minimal columns - no active, no last_updated
      id: text()
        .primaryKey()
        .$defaultFn(() => uuid.v4()),
      created_at: text().notNull().default(timestampDefault),
      // _metadata is required for PowerSync sync tracking
      _metadata: text({ mode: 'json' }).$type<OpMetadata>(),
      profile_id: text()
        .notNull()
        .references(() => profile.id),
      organization_name: text(),
      title: text().notNull(),
      request_type: text({ enum: requestTypeOptions }).notNull(),
      description: text().notNull(),
      app_version: text()
    },
    (table) => {
      return [
        index('feedback_profile_id_idx').on(table.profile_id),
        index('feedback_request_type_idx').on(table.request_type)
      ];
    }
  );

  return table;
}

export function createBlockedUsersTable({ profile }: { profile: TableRef }) {
  const table = sqliteTable(
    'blocked_users',
    {
      ...getBaseColumns(),
      blocker_id: text()
        .notNull()
        .references(() => profile.id),
      blocked_id: text()
        .notNull()
        .references(() => profile.id)
    },
    (table) => [primaryKey({ columns: [table.blocker_id, table.blocked_id] })]
  );

  return table;
}

export function createBlockedContentTable({ profile }: { profile: TableRef }) {
  const table = sqliteTable(
    'blocked_content',
    {
      ...getTableColumns(),
      content_id: text().notNull(),
      content_table: text().notNull(),
      profile_id: text()
        .notNull()
        .references(() => profile.id)
    },
    (table) => [
      index('profile_id_idx').on(table.profile_id),
      index('content_id_content_table_idx').on(
        table.content_id,
        table.content_table
      )
    ]
  );

  return table;
}

export function createAssetContentLinkTable({
  asset,
  language
}: {
  asset: TableRef;
  language: TableRef;
}) {
  const table = sqliteTable(
    'asset_content_link',
    {
      ...getTableColumns(),
      text: text(),
      audio: text({ mode: 'json' }).$type<string[]>(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      asset_id: text()
        .notNull()
        .references(() => asset.id),
      source_language_id: text(), // FK to language dropped - migrating to languoid
      languoid_id: text(), // Reference to languoid table
      order_index: int().notNull().default(0),
      uploaded_at: text(), // Nullable - set by server trigger when content is uploaded
      audio_uploaded_at: text() // Nullable - set by server triggers from storage.objects.created_at
    },
    (table) => {
      return [
        index('asset_id_idx').on(table.asset_id),
        index('asset_content_link_source_language_id_idx').on(
          table.source_language_id
        ),
        index('idx_acl_asset_order').on(table.asset_id, table.order_index),
        // The audio sync workers' work-list queries filter on this column on
        // every pass (and via db.watch during sync); IS NULL matches ~0 rows
        // in steady state, so this turns a full scan into an index seek.
        index('idx_acl_audio_uploaded_at').on(table.audio_uploaded_at)
      ];
    }
  );

  return table;
}

export function createProjectLanguageLinkTable({
  project,
  language
}: {
  project: TableRef;
  language: TableRef;
}) {
  const table = sqliteTable(
    'project_language_link',
    {
      ...getBaseColumns(),
      language_type: text({ enum: ['source', 'target'] }).notNull(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      project_id: text()
        .notNull()
        .references(() => project.id),
      language_id: text(), // Nullable - kept for backward compatibility
      languoid_id: text().notNull() // Part of new PK - canonical language reference
    },
    (table) => [
      primaryKey({
        columns: [table.project_id, table.languoid_id, table.language_type]
      }),
      index('pll_project_id_idx').on(table.project_id),
      index('pll_language_type_idx').on(table.language_type),
      index('pll_language_id_idx').on(table.language_id) // For backward compatibility
    ]
  );

  return table;
}

export function createQuestTagLinkTable({
  quest,
  tag
}: {
  quest: TableRef;
  tag: TableRef;
}) {
  const table = sqliteTable(
    'quest_tag_link',
    {
      ...getBaseColumns(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      quest_id: text()
        .notNull()
        .references(() => quest.id),
      tag_id: text()
        .notNull()
        .references(() => tag.id)
    },
    (table) => [primaryKey({ columns: [table.quest_id, table.tag_id] })]
  );

  return table;
}

export function createAssetTagLinkTable({
  asset,
  tag
}: {
  asset: TableRef;
  tag: TableRef;
}) {
  const table = sqliteTable(
    'asset_tag_link',
    {
      ...getBaseColumns(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      asset_id: text()
        .notNull()
        .references(() => asset.id),
      tag_id: text()
        .notNull()
        .references(() => tag.id)
    },
    (table) => [primaryKey({ columns: [table.asset_id, table.tag_id] })]
  );

  return table;
}

export function createQuestAssetLinkTable({
  quest,
  asset
}: {
  quest: TableRef;
  asset: TableRef;
}) {
  const table = sqliteTable(
    'quest_asset_link',
    {
      ...getBaseColumns(),
      name: text(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      visible: int({ mode: 'boolean' }).notNull().default(true),
      quest_id: text()
        .notNull()
        .references(() => quest.id),
      asset_id: text()
        .notNull()
        .references(() => asset.id),
      order_index: int().notNull().default(0),
      metadata: text(),
      uploaded_at: text() // Nullable - set by server trigger when content is uploaded
    },
    (table) => [primaryKey({ columns: [table.quest_id, table.asset_id] })]
  );

  return table;
}

export function createNotificationTable({ profile }: { profile: TableRef }) {
  const table = sqliteTable('notification', {
    ...getTableColumns(),
    viewed: int({ mode: 'boolean' }).notNull().default(false),
    target_table_name: text().notNull(),
    target_record_id: text().notNull(),
    profile_id: text()
      .notNull()
      .references(() => profile.id)
  });

  return table;
}

export function createInviteTable({
  senderProfile,
  receiverProfile,
  project
}: {
  senderProfile: TableRef;
  receiverProfile: TableRef;
  project: TableRef;
}) {
  const table = sqliteTable(
    'invite',
    {
      ...getTableColumns(),
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
      // Email tracking columns
      resend_email_id: text(),
      email_status: text({ enum: emailStatusOptions }),
      email_sent_at: text(), // ISO timestamp
      email_delivered_at: text(), // ISO timestamp
      email_bounced_at: text(), // ISO timestamp
      bounce_type: text({ enum: inviteBounceTypeOptions }),
      bounce_reason: text({ enum: inviteBounceReasonOptions }),
      bounce_notice_dismissed_at: text() // ISO timestamp — sender dismissed delivery notice
    },
    (table) => [
      index('idx_invite_request_receiver_email').on(table.email),
      index('idx_invite_resend_email_id').on(table.resend_email_id)
    ]
  );

  return table;
}

export function createProfileProjectLinkTable({
  profile,
  project
}: {
  profile: TableRef;
  project: TableRef;
}) {
  const table = sqliteTable(
    'profile_project_link',
    {
      ...getBaseColumns(),
      membership: text({ enum: membershipOptions }).default('member').notNull(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      profile_id: text()
        .notNull()
        .references(() => profile.id),
      project_id: text()
        .notNull()
        .references(() => project.id)
    },
    (table) => [primaryKey({ columns: [table.profile_id, table.project_id] })]
  );

  return table;
}

export function createRequestTable({
  senderProfile,
  project
}: {
  senderProfile: TableRef;
  project: TableRef;
}) {
  const table = sqliteTable('request', {
    ...getTableColumns(),
    status: text({ enum: statusOptions }).notNull(),
    count: int().notNull(),
    sender_profile_id: text()
      .notNull()
      .references(() => senderProfile.id),
    project_id: text()
      .notNull()
      .references(() => project.id)
  });

  return table;
}

export function createSubscriptionTable({ profile }: { profile: TableRef }) {
  const table = sqliteTable('subscription', {
    ...getTableColumns(),
    target_record_id: text().notNull(),
    target_table_name: text().notNull(),
    profile_id: text()
      .notNull()
      .references(() => profile.id)
  });

  return table;
}

export function createQuestClosureTable({
  quest,
  project
}: {
  quest: TableRef;
  project: TableRef;
}) {
  const table = sqliteTable(
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

      last_updated: text().notNull().default(timestampDefault)
    },
    (table) => [
      index('quest_closure_project_id_idx').on(table.project_id),
      index('quest_closure_last_updated_idx').on(table.last_updated)
    ]
  );

  return table;
}

export function createProjectClosureTable({ project }: { project: TableRef }) {
  const table = sqliteTable(
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
        .references(() => project.id)
    },
    (table) => [
      index('project_closure_last_updated_idx').on(table.last_updated)
    ]
  );

  return table;
}

// ============================================================================
// LANGUOID TABLE DEFINITIONS
// ============================================================================

export function createLanguoidTable({ profile }: { profile: TableRef }) {
  const table = sqliteTable(
    'languoid',
    {
      ...getTableColumns(),
      name: text(),
      parent_id: text().references((): AnySQLiteColumn => table.id),
      level: text({ enum: ['family', 'language', 'dialect'] }).notNull(),
      ui_ready: int({ mode: 'boolean' }).notNull().default(false),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id)
    },
    (table) => [
      index('languoid_parent_id_idx').on(table.parent_id),
      index('languoid_name_idx').on(table.name),
      index('languoid_ui_ready_idx').on(table.ui_ready)
    ]
  );

  return table;
}

export function createLanguoidAliasTable({
  languoid,
  profile
}: {
  languoid: { id: AnySQLiteColumn };
  profile: TableRef;
}) {
  const table = sqliteTable(
    'languoid_alias',
    {
      ...getTableColumns(),
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
      creator_id: text().references(() => profile.id)
    },
    (table) => [
      index('languoid_alias_subject_idx').on(table.subject_languoid_id),
      index('languoid_alias_label_idx').on(table.label_languoid_id),
      index('languoid_alias_name_idx').on(table.name)
    ]
  );

  return table;
}

export function createLanguoidSourceTable({
  languoid,
  profile
}: {
  languoid: { id: AnySQLiteColumn };
  profile: TableRef;
}) {
  const table = sqliteTable(
    'languoid_source',
    {
      ...getTableColumns(),
      name: text().notNull(),
      version: text(),
      languoid_id: text()
        .notNull()
        .references(() => languoid.id),
      unique_identifier: text(),
      url: text(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id)
    },
    (table) => [
      index('languoid_source_languoid_id_idx').on(table.languoid_id),
      index('languoid_source_unique_identifier_idx').on(table.unique_identifier)
    ]
  );

  return table;
}

export function createLanguoidPropertyTable({
  languoid,
  profile
}: {
  languoid: { id: AnySQLiteColumn };
  profile: TableRef;
}) {
  const table = sqliteTable(
    'languoid_property',
    {
      ...getTableColumns(),
      languoid_id: text()
        .notNull()
        .references(() => languoid.id),
      key: text().notNull(),
      value: text().notNull(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id)
    },
    (table) => [
      index('languoid_property_languoid_id_idx').on(table.languoid_id),
      index('languoid_property_key_idx').on(table.key)
    ]
  );

  return table;
}

export function createRegionTable({ profile }: { profile: TableRef }) {
  const table = sqliteTable(
    'region',
    {
      ...getTableColumns(),
      name: text(),
      parent_id: text().references((): AnySQLiteColumn => table.id),
      level: text({ enum: ['continent', 'nation', 'subnational'] }).notNull(),
      geometry: int({ mode: 'boolean' }).notNull().default(false),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id)
    },
    (table) => [
      index('region_parent_id_idx').on(table.parent_id),
      index('region_name_idx').on(table.name),
      index('region_level_idx').on(table.level)
    ]
  );

  return table;
}

export function createRegionAliasTable({
  region,
  languoid,
  profile
}: {
  region: { id: AnySQLiteColumn };
  languoid: { id: AnySQLiteColumn };
  profile: TableRef;
}) {
  const table = sqliteTable(
    'region_alias',
    {
      ...getTableColumns(),
      subject_region_id: text()
        .notNull()
        .references(() => region.id),
      label_languoid_id: text()
        .notNull()
        .references(() => languoid.id),
      name: text(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id)
    },
    (table) => [
      index('region_alias_subject_idx').on(table.subject_region_id),
      index('region_alias_label_idx').on(table.label_languoid_id),
      index('region_alias_name_idx').on(table.name)
    ]
  );

  return table;
}

export function createRegionSourceTable({
  region,
  profile
}: {
  region: { id: AnySQLiteColumn };
  profile: TableRef;
}) {
  const table = sqliteTable(
    'region_source',
    {
      ...getTableColumns(),
      name: text().notNull(),
      version: text(),
      region_id: text()
        .notNull()
        .references(() => region.id),
      unique_identifier: text(),
      url: text(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id)
    },
    (table) => [
      index('region_source_region_id_idx').on(table.region_id),
      index('region_source_unique_identifier_idx').on(table.unique_identifier)
    ]
  );

  return table;
}

export function createRegionPropertyTable({
  region,
  profile
}: {
  region: { id: AnySQLiteColumn };
  profile: TableRef;
}) {
  const table = sqliteTable(
    'region_property',
    {
      ...getTableColumns(),
      region_id: text()
        .notNull()
        .references(() => region.id),
      key: text().notNull(),
      value: text().notNull(),
      download_profiles: text({ mode: 'json' }).$type<string[]>(),
      creator_id: text().references(() => profile.id)
    },
    (table) => [
      index('region_property_region_id_idx').on(table.region_id),
      index('region_property_key_idx').on(table.key)
    ]
  );

  return table;
}

export function createLanguoidRegionTable({
  languoid,
  region,
  profile
}: {
  languoid: { id: AnySQLiteColumn };
  region: { id: AnySQLiteColumn };
  profile: TableRef;
}) {
  const table = sqliteTable(
    'languoid_region',
    {
      ...getTableColumns(),
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
      creator_id: text().references(() => profile.id)
    },
    (table) => [
      index('languoid_region_languoid_id_idx').on(table.languoid_id),
      index('languoid_region_region_id_idx').on(table.region_id)
    ]
  );

  return table;
}

// Note: statusOptions and matchedOnOptions are imported from constants.ts at the top of the file

export function createLanguoidLinkSuggestionTable({
  languoid,
  profile
}: {
  languoid: { id: AnySQLiteColumn };
  profile: TableRef;
}) {
  const table = sqliteTable(
    'languoid_link_suggestion',
    {
      ...getTableColumns(),
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
      status: text({ enum: statusOptions }).notNull().default('pending')
    },
    (table) => [
      index('languoid_link_suggestion_user_languoid_idx').on(table.languoid_id),
      index('languoid_link_suggestion_creator_idx').on(table.profile_id),
      index('languoid_link_suggestion_status_idx').on(table.status)
    ]
  );

  return table;
}

export function createProjectLanguoidSuggestionTable({
  project,
  languoid
}: {
  project: { id: AnySQLiteColumn };
  languoid: { id: AnySQLiteColumn };
}) {
  const table = sqliteTable(
    'project_languoid_suggestion',
    {
      ...getTableColumns(),
      project_id: text()
        .notNull()
        .references(() => project.id),
      current_languoid_id: text()
        .notNull()
        .references(() => languoid.id),
      suggested_languoid_id: text()
        .notNull()
        .references(() => languoid.id),
      language_type: text({ enum: ['source', 'target'] })
        .notNull()
        .default('target'),
      matched_value: text(),
      status: text({ enum: statusOptions }).notNull().default('pending')
    },
    (table) => [
      index('project_languoid_suggestion_project_idx').on(table.project_id),
      index('project_languoid_suggestion_status_idx').on(table.status)
    ]
  );

  return table;
}
