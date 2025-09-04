import { relations, sql } from 'drizzle-orm';
import {
  index,
  int,
  primaryKey,
  sqliteTable,
  sqliteView,
  text
} from 'drizzle-orm/sqlite-core';
import { reasonOptions, statusOptions } from './constants';

// NOTE: If you are using Drizzle with PowerSync and need to refer to the Postgres type for sync rules,
// see the official PowerSync documentation for the correct column types:
// https://docs.powersync.com/usage/sync-rules/types#types

const uuidDefault = sql`(lower(hex(randomblob(16))))`;
const timestampDefault = sql`(CURRENT_TIMESTAMP)`;

const linkColumns = {
  id: text().notNull(),
  active: int({ mode: 'boolean' }).notNull().default(true),
  created_at: text().notNull().default(timestampDefault),
  last_updated: text()
    .notNull()
    .default(timestampDefault)
    .$onUpdate(() => timestampDefault)
};

// Base columns that most tables will have
const baseColumns = {
  ...linkColumns,
  id: text()
    .primaryKey()
    .$defaultFn(() => uuidDefault)
};

export const profile = sqliteTable('profile', {
  ...baseColumns,
  email: text(),
  username: text(),
  password: text(),
  avatar: text(),
  ui_language_id: text(),
  terms_accepted: int({ mode: 'boolean' }),
  terms_accepted_at: text()
});

export const userRelations = relations(profile, ({ many, one }) => ({
  created_languages: many(language, { relationName: 'creator' }),
  ui_language: one(language, {
    fields: [profile.ui_language_id],
    references: [language.id],
    relationName: 'uiLanguage'
  }),
  sent_invites: many(invite, { relationName: 'invite_sender' }),
  received_invites: many(invite, { relationName: 'invite_receiver' }),
  sent_requests: many(request, { relationName: 'request_sender' })
}));

export const language = sqliteTable(
  'language',
  {
    ...baseColumns,
    // Enforce the existence of either native_name or english_name in the app
    native_name: text(), // Enforce uniqueness across chains in the app
    english_name: text(), // Enforce uniqueness across chains in the app
    iso639_3: text(), // Enforce uniqueness across chains in the app
    locale: text(),
    ui_ready: int({ mode: 'boolean' }).notNull(),
    creator_id: text().references(() => profile.id),
    download_profiles: text({ mode: 'json' }).$type<string[]>()
  },
  (table) => [index('ui_ready_idx').on(table.ui_ready)]
);

export const languageRelations = relations(language, ({ one, many }) => ({
  creator: one(profile, {
    fields: [language.creator_id],
    references: [profile.id],
    relationName: 'creator'
  }),
  uiUsers: many(profile, { relationName: 'uiLanguage' }),
  sourceLanguageProjects: many(project, { relationName: 'sourceLanguage' }),
  targetLanguageProjects: many(project, { relationName: 'targetLanguage' })
}));
export const project = sqliteTable(
  'project',
  {
    ...baseColumns,
    name: text().notNull(),
    description: text(),
    target_language_id: text()
      .notNull()
      .references(() => language.id),
    creator_id: text().references(() => profile.id),
    private: int({ mode: 'boolean' }).notNull().default(false),
    visible: int({ mode: 'boolean' }).notNull().default(true),
    download_profiles: text({ mode: 'json' }).$type<string[]>()
  },
  (table) => [
    index('name_idx').on(table.name),
    index('target_language_id_idx').on(table.target_language_id)
  ]
);

export const projectRelations = relations(project, ({ one, many }) => ({
  target_language: one(language, {
    fields: [project.target_language_id],
    references: [language.id],
    relationName: 'targetLanguage'
  }),
  quests: many(quest),
  profile_project_links: many(profile_project_link),
  source_languages: many(project_language_link),
  invites: many(invite),
  requests: many(request)
}));

// (removed duplicate early definition of project_language_link)
export const quest = sqliteTable(
  'quest',
  {
    ...baseColumns,
    name: text().notNull(),
    description: text(),
    project_id: text()
      .notNull()
      .references(() => project.id),
    creator_id: text().references(() => profile.id),
    visible: int({ mode: 'boolean' }).notNull().default(true),
    download_profiles: text({ mode: 'json' }).$type<string[]>()
  },
  (table) => [
    index('project_id_idx').on(table.project_id),
    index('name_idx').on(table.name)
  ]
);

export const questRelations = relations(quest, ({ one, many }) => ({
  project: one(project, {
    fields: [quest.project_id],
    references: [project.id]
  }),
  tags: many(quest_tag_link),
  assets: many(quest_asset_link)
}));

export const tag = sqliteTable('tag', {
  ...baseColumns,
  name: text().notNull(),
  download_profiles: text({ mode: 'json' }).$type<string[]>()
});

export const tagRelations = relations(tag, ({ many }) => ({
  quests: many(quest_tag_link),
  assets: many(asset_tag_link)
}));

export const quest_tag_link = sqliteTable(
  'quest_tag_link',
  {
    ...linkColumns,
    quest_id: text().notNull(),
    tag_id: text().notNull(),
    download_profiles: text({ mode: 'json' }).$type<string[]>()
  },
  (t) => [primaryKey({ columns: [t.quest_id, t.tag_id] })]
);

export const quest_tag_linkRelations = relations(quest_tag_link, ({ one }) => ({
  quest: one(quest, {
    fields: [quest_tag_link.quest_id],
    references: [quest.id]
  }),
  tag: one(tag, {
    fields: [quest_tag_link.tag_id],
    references: [tag.id]
  })
}));
export const asset = sqliteTable(
  'asset',
  {
    ...baseColumns,
    name: text().notNull(),
    source_language_id: text()
      .notNull()
      .references(() => language.id),
    images: text({ mode: 'json' }).$type<string[]>(),
    creator_id: text().references(() => profile.id),
    visible: int({ mode: 'boolean' }).notNull().default(true),
    download_profiles: text({ mode: 'json' }).$type<string[]>()
  },
  (table) => [
    index('name_idx').on(table.name),
    index('source_language_id_idx').on(table.source_language_id)
  ]
);

export const assetRelations = relations(asset, ({ one, many }) => ({
  source_language: one(language, {
    fields: [asset.source_language_id],
    references: [language.id]
  }),
  tags: many(asset_tag_link),
  quests: many(quest_asset_link),
  translations: many(translation),
  content: many(asset_content_link)
}));

export const asset_tag_link = sqliteTable(
  'asset_tag_link',
  {
    ...linkColumns,
    asset_id: text().notNull(),
    tag_id: text().notNull(),
    download_profiles: text({ mode: 'json' }).$type<string[]>()
  },
  (t) => [primaryKey({ columns: [t.asset_id, t.tag_id] })]
);

export const asset_tag_linkRelations = relations(asset_tag_link, ({ one }) => ({
  asset: one(asset, {
    fields: [asset_tag_link.asset_id],
    references: [asset.id]
  }),
  tag: one(tag, {
    fields: [asset_tag_link.tag_id],
    references: [tag.id]
  })
}));

export const quest_asset_link = sqliteTable(
  'quest_asset_link',
  {
    ...linkColumns,
    quest_id: text().notNull(),
    asset_id: text().notNull(),
    download_profiles: text({ mode: 'json' }).$type<string[]>(),
    visible: int({ mode: 'boolean' }).notNull().default(true)
  },
  (t) => [primaryKey({ columns: [t.quest_id, t.asset_id] })]
);

export const quest_asset_linkRelations = relations(
  quest_asset_link,
  ({ one }) => ({
    quest: one(quest, {
      fields: [quest_asset_link.quest_id],
      references: [quest.id]
    }),
    asset: one(asset, {
      fields: [quest_asset_link.asset_id],
      references: [asset.id]
    })
  })
);

// Project-language link with explicit type separation (source/target)
export const project_language_link = sqliteTable(
  'project_language_link',
  {
    ...linkColumns,
    project_id: text()
      .notNull()
      .references(() => project.id),
    language_id: text()
      .notNull()
      .references(() => language.id),
    language_type: text({ enum: ['source', 'target'] }).notNull(),
    download_profiles: text({ mode: 'json' }).$type<string[]>()
  },
  (t) => [
    primaryKey({ columns: [t.project_id, t.language_id, t.language_type] }),
    index('pll_project_id_idx').on(t.project_id),
    index('pll_language_type_idx').on(t.language_type)
  ]
);

export const project_language_linkRelations = relations(
  project_language_link,
  ({ one }) => ({
    project: one(project, {
      fields: [project_language_link.project_id],
      references: [project.id]
    }),
    language: one(language, {
      fields: [project_language_link.language_id],
      references: [language.id]
    })
  })
);
export const translation = sqliteTable(
  'translation',
  {
    ...baseColumns,
    asset_id: text()
      .notNull()
      .references(() => asset.id),
    target_language_id: text()
      .notNull()
      .references(() => language.id),
    text: text(),
    audio: text(),
    creator_id: text()
      .notNull()
      .references(() => profile.id),
    visible: int({ mode: 'boolean' }).notNull().default(true),
    download_profiles: text({ mode: 'json' }).$type<string[]>()
  },
  (t) => [
    index('asset_id_idx').on(t.asset_id),
    index('creator_id_idx').on(t.creator_id)
  ]
);

export const translationRelations = relations(translation, ({ one, many }) => ({
  asset: one(asset, {
    fields: [translation.asset_id],
    references: [asset.id]
  }),
  target_language: one(language, {
    fields: [translation.target_language_id],
    references: [language.id]
  }),
  creator: one(profile, {
    fields: [translation.creator_id],
    references: [profile.id]
  }),
  votes: many(vote),
  reports: many(reports, { relationName: 'translation_reports' })
}));

export const reports = sqliteTable(
  'reports',
  {
    ...baseColumns,
    record_id: text().notNull(),
    record_table: text().notNull(),
    reporter_id: text().references(() => profile.id),
    reason: text({
      enum: reasonOptions
    }).notNull(),
    details: text()
  },
  (table) => [
    index('record_id_record_table_idx').on(table.record_id, table.record_table),
    index('reporter_id_idx').on(table.reporter_id)
  ]
);

export const blocked_users = sqliteTable(
  'blocked_users',
  {
    ...linkColumns,
    blocker_id: text()
      .notNull()
      .references(() => profile.id),
    blocked_id: text()
      .notNull()
      .references(() => profile.id)
  },
  (t) => [primaryKey({ columns: [t.blocker_id, t.blocked_id] })]
);

export const blocked_usersRelations = relations(blocked_users, ({ one }) => ({
  blocker: one(profile, {
    fields: [blocked_users.blocker_id],
    references: [profile.id],
    relationName: 'blocker'
  }),
  blocked: one(profile, {
    fields: [blocked_users.blocked_id],
    references: [profile.id],
    relationName: 'blocked'
  })
}));

export const blocked_content = sqliteTable(
  'blocked_content',
  {
    ...baseColumns,
    profile_id: text()
      .notNull()
      .references(() => profile.id),
    content_id: text().notNull(),
    content_table: text().notNull()
  },
  (t) => [
    index('profile_id_idx').on(t.profile_id),
    index('content_id_content_table_idx').on(t.content_id, t.content_table)
  ]
);

export const blocked_contentRelations = relations(
  blocked_content,
  ({ one }) => ({
    profile: one(profile, {
      fields: [blocked_content.profile_id],
      references: [profile.id]
    })
  })
);

export const reportRelations = relations(reports, ({ one }) => ({
  reporter: one(profile, {
    fields: [reports.reporter_id],
    references: [profile.id]
  }),
  translation: one(translation, {
    fields: [reports.record_id],
    references: [translation.id],
    relationName: 'translation_reports'
  })
}));

export const vote = sqliteTable(
  'vote',
  {
    ...baseColumns,
    translation_id: text()
      .notNull()
      .references(() => translation.id),
    polarity: text({ enum: ['up', 'down'] }).notNull(),
    comment: text(),
    creator_id: text()
      .notNull()
      .references(() => profile.id),
    download_profiles: text({ mode: 'json' }).$type<string[]>()
  },
  (t) => [
    index('translation_id_idx').on(t.translation_id),
    index('creator_id_idx').on(t.creator_id),
    index('translation_id_creator_id_idx').on(t.translation_id, t.creator_id)
  ]
);

export const voteRelations = relations(vote, ({ one }) => ({
  translation: one(translation, {
    fields: [vote.translation_id],
    references: [translation.id]
  }),
  creator: one(profile, {
    fields: [vote.creator_id],
    references: [profile.id]
  })
}));

export const asset_content_link = sqliteTable(
  'asset_content_link',
  {
    ...baseColumns,
    asset_id: text()
      .notNull()
      .references(() => asset.id),
    source_language_id: text().references(() => language.id),
    text: text().notNull(),
    audio_id: text(),
    download_profiles: text({ mode: 'json' }).$type<string[]>()
  },
  (t) => [
    index('asset_id_idx').on(t.asset_id),
    index('asset_content_link_source_language_id_idx').on(t.source_language_id)
  ]
);

export const asset_content_linkRelations = relations(
  asset_content_link,
  ({ one }) => ({
    asset: one(asset, {
      fields: [asset_content_link.asset_id],
      references: [asset.id]
    }),
    source_language: one(language, {
      fields: [asset_content_link.source_language_id],
      references: [language.id]
    })
  })
);

export const flag = sqliteTable('flag', {
  ...baseColumns,
  name: text().notNull().unique()
});

export const invite = sqliteTable(
  'invite',
  {
    ...baseColumns,
    sender_profile_id: text()
      .notNull()
      .references(() => profile.id),
    receiver_profile_id: text().references(() => profile.id),
    project_id: text()
      .notNull()
      .references(() => project.id),
    status: text({ enum: statusOptions }).notNull(),
    as_owner: int({ mode: 'boolean' }).notNull().default(false),
    email: text().notNull(),
    count: int().notNull()
  },
  (table) => [index('idx_invite_request_receiver_email').on(table.email)]
);

export const inviteRelations = relations(invite, ({ one }) => ({
  sender: one(profile, {
    fields: [invite.sender_profile_id],
    references: [profile.id],
    relationName: 'invite_sender'
  }),
  receiver: one(profile, {
    fields: [invite.receiver_profile_id],
    references: [profile.id],
    relationName: 'invite_receiver'
  }),
  project: one(project, {
    fields: [invite.project_id],
    references: [project.id]
  })
}));

export const request = sqliteTable('request', {
  ...baseColumns,
  sender_profile_id: text()
    .notNull()
    .references(() => profile.id),
  project_id: text()
    .notNull()
    .references(() => project.id),
  status: text({ enum: statusOptions }).notNull(),
  count: int().notNull()
});

export const requestRelations = relations(request, ({ one }) => ({
  sender: one(profile, {
    fields: [request.sender_profile_id],
    references: [profile.id],
    relationName: 'request_sender'
  }),
  project: one(project, {
    fields: [request.project_id],
    references: [project.id]
  })
}));

export const notification = sqliteTable('notification', {
  ...baseColumns,
  profile_id: text()
    .notNull()
    .references(() => profile.id),
  viewed: int({ mode: 'boolean' }).notNull().default(false),
  target_table_name: text().notNull(),
  target_record_id: text().notNull()
});

export const notificationRelations = relations(notification, ({ one }) => ({
  profile: one(profile, {
    fields: [notification.profile_id],
    references: [profile.id]
  })
}));

export const profile_project_link = sqliteTable(
  'profile_project_link',
  {
    ...linkColumns,
    profile_id: text()
      .notNull()
      .references(() => profile.id),
    project_id: text()
      .notNull()
      .references(() => project.id),
    membership: text()
  },
  (t) => [primaryKey({ columns: [t.profile_id, t.project_id] })]
);

export const profileProjectLinkRelations = relations(
  profile_project_link,
  ({ one }) => ({
    profile: one(profile, {
      fields: [profile_project_link.profile_id],
      references: [profile.id]
    }),
    project: one(project, {
      fields: [profile_project_link.project_id],
      references: [project.id]
    })
  })
);

export const subscription = sqliteTable('subscription', {
  ...baseColumns,
  profile_id: text()
    .notNull()
    .references(() => profile.id),
  target_record_id: text().notNull(),
  target_table_name: text().notNull()
});

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  profile: one(profile, {
    fields: [subscription.profile_id],
    references: [profile.id]
  })
}));

// ====================================
// VIEWS
// ====================================

// Asset tag categories view - extracts distinct tag categories (part before ':') for each quest via asset tags
export const asset_tag_categories = sqliteView('asset_tag_categories', {
  quest_id: text('quest_id').notNull(),
  tag_categories: text('tag_categories', { mode: 'json' }).$type<string[]>() // SQLite stores as comma-separated string
}).as(sql`
  SELECT
    q.id AS quest_id,
    GROUP_CONCAT(DISTINCT
      CASE
        WHEN INSTR(t.name, ':') > 0
        THEN SUBSTR(t.name, 1, INSTR(t.name, ':') - 1)
        ELSE t.name
      END
    ) AS tag_categories
  FROM quest q
  JOIN quest_asset_link qal ON q.id = qal.quest_id
  JOIN asset a ON qal.asset_id = a.id
  JOIN asset_tag_link atl ON a.id = atl.asset_id
  JOIN tag t ON atl.tag_id = t.id
  GROUP BY q.id
  ORDER BY q.id
`);

// Quest tag categories view - extracts distinct tag categories for all quests in each project
export const quest_tag_categories = sqliteView('quest_tag_categories', {
  project_id: text('project_id').notNull(),
  tag_categories: text('tag_categories', { mode: 'json' }).$type<string[]>() // SQLite stores as comma-separated string
}).as(sql`
  SELECT
    p.id AS project_id,
    GROUP_CONCAT(DISTINCT
      CASE
        WHEN INSTR(t.name, ':') > 0
        THEN SUBSTR(t.name, 1, INSTR(t.name, ':') - 1)
        ELSE t.name
      END
    ) AS tag_categories
  FROM project p
  JOIN quest q ON q.project_id = p.id
  JOIN quest_asset_link qal ON q.id = qal.quest_id
  JOIN asset a ON qal.asset_id = a.id
  JOIN asset_tag_link atl ON a.id = atl.asset_id
  JOIN tag t ON atl.tag_id = t.id
  GROUP BY p.id
  ORDER BY p.id
`);

// ====================================
// CLOSURE AND AGGREGATE TABLES
// ====================================

export const quest_closure = sqliteTable(
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
    quest_asset_link_ids: text({ mode: 'json' }).$type<string[]>().default([]),
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

export const quest_closureRelations = relations(quest_closure, ({ one }) => ({
  quest: one(quest, {
    fields: [quest_closure.quest_id],
    references: [quest.id]
  }),
  project: one(project, {
    fields: [quest_closure.project_id],
    references: [project.id]
  })
}));

export const project_closure = sqliteTable(
  'project_closure',
  {
    project_id: text()
      .primaryKey()
      .references(() => project.id),

    // ID Arrays (for bulk downloads - aggregated from all quest closures)
    asset_ids: text({ mode: 'json' }).$type<string[]>().default([]),
    translation_ids: text({ mode: 'json' }).$type<string[]>().default([]),
    vote_ids: text({ mode: 'json' }).$type<string[]>().default([]),
    tag_ids: text({ mode: 'json' }).$type<string[]>().default([]),
    language_ids: text({ mode: 'json' }).$type<string[]>().default([]),
    quest_ids: text({ mode: 'json' }).$type<string[]>().default([]),
    quest_asset_link_ids: text({ mode: 'json' }).$type<string[]>().default([]),
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

    last_updated: text().notNull().default(timestampDefault)
  },
  (table) => [index('project_closure_last_updated_idx').on(table.last_updated)]
);

export const project_closureRelations = relations(
  project_closure,
  ({ one }) => ({
    project: one(project, {
      fields: [project_closure.project_id],
      references: [project.id]
    })
  })
);

// Deprecated - remove after migration
export const quest_aggregates = quest_closure;
