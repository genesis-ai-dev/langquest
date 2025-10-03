import { relations, sql } from 'drizzle-orm';
// import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { sqliteView, text } from 'drizzle-orm/sqlite-core';
import {
  createAssetContentLinkTable,
  createAssetTable,
  createAssetTagLinkTable,
  createBlockedContentTable,
  createBlockedUsersTable,
  createInviteTable,
  createLanguageTable,
  createNotificationTable,
  createProfileProjectLinkTable,
  createProfileTable,
  createProjectClosureTable,
  createProjectLanguageLinkTable,
  createProjectTable,
  createQuestAssetLinkTable,
  createQuestClosureTable,
  createQuestTable,
  createQuestTagLinkTable,
  createReportsTable,
  createRequestTable,
  createSubscriptionTable,
  createTagTable,
  createVoteTable
} from './drizzleSchemaColumns';

// NOTE: If you are using Drizzle with PowerSync and need to refer to the Postgres type for sync rules,
// see the official PowerSync documentation for the correct column types:
// https://docs.powersync.com/usage/sync-rules/types#types

// columns moved to ./drizzleSchemaColumns

export const profile_synced = createProfileTable('synced');

export const userRelations = relations(profile_synced, ({ many, one }) => ({
  created_languages: many(language_synced, { relationName: 'creator' }),
  ui_language: one(language_synced, {
    fields: [profile_synced.ui_language_id],
    references: [language_synced.id],
    relationName: 'uiLanguage'
  }),
  sent_invites: many(invite_synced, { relationName: 'invite_sender' }),
  received_invites: many(invite_synced, { relationName: 'invite_receiver' }),
  sent_requests: many(request_synced, { relationName: 'request_sender' })
}));

export const language_synced = createLanguageTable('synced', {
  profile: profile_synced
});

export const language_syncedRelations = relations(
  language_synced,
  ({ one, many }) => ({
    creator: one(profile_synced, {
      fields: [language_synced.creator_id],
      references: [profile_synced.id],
      relationName: 'creator'
    }),
    uiUsers: many(profile_synced, { relationName: 'uiLanguage' }),
    sourceLanguageProjects: many(project_synced, {
      relationName: 'sourceLanguage'
    }),
    targetLanguageProjects: many(project_synced, {
      relationName: 'targetLanguage'
    })
  })
);

export const project_synced = createProjectTable('synced', {
  language: language_synced,
  profile: profile_synced
});

export const project_syncedRelations = relations(
  project_synced,
  ({ one, many }) => ({
    target_language: one(language_synced, {
      fields: [project_synced.target_language_id],
      references: [language_synced.id],
      relationName: 'targetLanguage'
    }),
    quests: many(quest_synced),
    profile_project_links: many(profile_project_link_synced),
    source_languages: many(project_language_link_synced),
    invites: many(invite_synced),
    requests: many(request_synced)
  })
);

// (removed duplicate early definition of project_language_link)
export const quest_synced = createQuestTable('synced', {
  project: project_synced,
  profile: profile_synced
});

export const quest_syncedRelations = relations(
  quest_synced,
  ({ one, many }) => ({
    project: one(project_synced, {
      fields: [quest_synced.project_id],
      references: [project_synced.id]
    }),
    parent: one(quest_synced, {
      fields: [quest_synced.parent_id],
      references: [quest_synced.id],
      relationName: 'quest_parent'
    }),
    children: many(quest_synced, { relationName: 'quest_parent' }),
    tags: many(quest_tag_link_synced),
    assets: many(quest_asset_link_synced)
  })
);

export const tag_synced = createTagTable('synced');

export const tag_syncedRelations = relations(tag_synced, ({ many }) => ({
  quests: many(quest_tag_link_synced),
  assets: many(asset_tag_link_synced)
}));

export const quest_tag_link_synced = createQuestTagLinkTable('synced', {
  quest: quest_synced,
  tag: tag_synced
});

export const quest_tag_link_syncedRelations = relations(
  quest_tag_link_synced,
  ({ one }) => ({
    quest: one(quest_synced, {
      fields: [quest_tag_link_synced.quest_id],
      references: [quest_synced.id]
    }),
    tag: one(tag_synced, {
      fields: [quest_tag_link_synced.tag_id],
      references: [tag_synced.id]
    })
  })
);

export const asset_synced = createAssetTable('synced', {
  language: language_synced,
  project: project_synced,
  profile: profile_synced
});

export const asset_syncedRelations = relations(
  asset_synced,
  ({ one, many }) => ({
    source_language: one(language_synced, {
      fields: [asset_synced.source_language_id],
      references: [language_synced.id]
    }),
    project: one(project_synced, {
      fields: [asset_synced.project_id],
      references: [project_synced.id]
    }),
    source_asset: one(asset_synced, {
      fields: [asset_synced.source_asset_id],
      references: [asset_synced.id],
      relationName: 'asset_source'
    }),
    children: many(asset_synced, { relationName: 'asset_parent' }),
    tags: many(asset_tag_link_synced),
    quests: many(quest_asset_link_synced),
    content: many(asset_content_link_synced),
    votes: many(vote_synced)
  })
);

export const asset_tag_link_synced = createAssetTagLinkTable('synced', {
  asset: asset_synced,
  tag: tag_synced
});

export const asset_tag_link_syncedRelations = relations(
  asset_tag_link_synced,
  ({ one }) => ({
    asset: one(asset_synced, {
      fields: [asset_tag_link_synced.asset_id],
      references: [asset_synced.id]
    }),
    tag: one(tag_synced, {
      fields: [asset_tag_link_synced.tag_id],
      references: [tag_synced.id]
    })
  })
);

export const quest_asset_link_synced = createQuestAssetLinkTable('synced', {
  quest: quest_synced,
  asset: asset_synced
});

export const quest_asset_link_syncedRelations = relations(
  quest_asset_link_synced,
  ({ one }) => ({
    quest: one(quest_synced, {
      fields: [quest_asset_link_synced.quest_id],
      references: [quest_synced.id]
    }),
    asset: one(asset_synced, {
      fields: [quest_asset_link_synced.asset_id],
      references: [asset_synced.id]
    })
  })
);

// Project-language link with explicit type separation (source/target)
export const project_language_link_synced = createProjectLanguageLinkTable(
  'synced',
  {
    project: project_synced,
    language: language_synced
  }
);

export const project_language_link_syncedRelations = relations(
  project_language_link_synced,
  ({ one }) => ({
    project: one(project_synced, {
      fields: [project_language_link_synced.project_id],
      references: [project_synced.id]
    }),
    language: one(language_synced, {
      fields: [project_language_link_synced.language_id],
      references: [language_synced.id]
    })
  })
);

export const reports_synced = createReportsTable('synced', {
  profile: profile_synced
});

export const blocked_users_synced = createBlockedUsersTable('synced', {
  profile: profile_synced
});

export const blocked_users_syncedRelations = relations(
  blocked_users_synced,
  ({ one }) => ({
    blocker: one(profile_synced, {
      fields: [blocked_users_synced.blocker_id],
      references: [profile_synced.id],
      relationName: 'blocker'
    }),
    blocked: one(profile_synced, {
      fields: [blocked_users_synced.blocked_id],
      references: [profile_synced.id],
      relationName: 'blocked'
    })
  })
);

export const blocked_content_synced = createBlockedContentTable('synced', {
  profile: profile_synced
});

export const blocked_content_syncedRelations = relations(
  blocked_content_synced,
  ({ one }) => ({
    profile: one(profile_synced, {
      fields: [blocked_content_synced.profile_id],
      references: [profile_synced.id]
    })
  })
);

export const report_syncedRelations = relations(reports_synced, ({ one }) => ({
  reporter: one(profile_synced, {
    fields: [reports_synced.reporter_id],
    references: [profile_synced.id]
  }),
  translation: one(asset_synced, {
    fields: [reports_synced.record_id],
    references: [asset_synced.id],
    relationName: 'translation_reports'
  })
}));

export const vote_synced = createVoteTable('synced', {
  asset: asset_synced,
  profile: profile_synced
});

export const vote_syncedRelations = relations(vote_synced, ({ one }) => ({
  asset: one(asset_synced, {
    fields: [vote_synced.asset_id],
    references: [asset_synced.id]
  }),
  creator: one(profile_synced, {
    fields: [vote_synced.creator_id],
    references: [profile_synced.id]
  })
}));

export const asset_content_link_synced = createAssetContentLinkTable('synced', {
  asset: asset_synced,
  language: language_synced
});

export const asset_content_link_syncedRelations = relations(
  asset_content_link_synced,
  ({ one }) => ({
    asset: one(asset_synced, {
      fields: [asset_content_link_synced.asset_id],
      references: [asset_synced.id]
    }),
    source_language: one(language_synced, {
      fields: [asset_content_link_synced.source_language_id],
      references: [language_synced.id]
    })
  })
);

export const invite_synced = createInviteTable('synced', {
  senderProfile: profile_synced,
  receiverProfile: profile_synced,
  project: project_synced
});

export const invite_syncedRelations = relations(invite_synced, ({ one }) => ({
  sender: one(profile_synced, {
    fields: [invite_synced.sender_profile_id],
    references: [profile_synced.id],
    relationName: 'invite_sender'
  }),
  receiver: one(profile_synced, {
    fields: [invite_synced.receiver_profile_id],
    references: [profile_synced.id],
    relationName: 'invite_receiver'
  }),
  project: one(project_synced, {
    fields: [invite_synced.project_id],
    references: [project_synced.id]
  })
}));

export const request_synced = createRequestTable('synced', {
  senderProfile: profile_synced,
  project: project_synced
});

export const request_syncedRelations = relations(request_synced, ({ one }) => ({
  sender: one(profile_synced, {
    fields: [request_synced.sender_profile_id],
    references: [profile_synced.id],
    relationName: 'request_sender'
  }),
  project: one(project_synced, {
    fields: [request_synced.project_id],
    references: [project_synced.id]
  })
}));

export const notification_synced = createNotificationTable('synced', {
  profile: profile_synced
});

export const notification_syncedRelations = relations(
  notification_synced,
  ({ one }) => ({
    profile: one(profile_synced, {
      fields: [notification_synced.profile_id],
      references: [profile_synced.id]
    })
  })
);

export const profile_project_link_synced = createProfileProjectLinkTable(
  'synced',
  {
    profile: profile_synced,
    project: project_synced
  }
);

export const profileProjectLink_syncedRelations = relations(
  profile_project_link_synced,
  ({ one }) => ({
    profile: one(profile_synced, {
      fields: [profile_project_link_synced.profile_id],
      references: [profile_synced.id]
    }),
    project: one(project_synced, {
      fields: [profile_project_link_synced.project_id],
      references: [project_synced.id]
    })
  })
);

export const subscription_synced = createSubscriptionTable('synced', {
  profile: profile_synced
});

export const subscription_syncedRelations = relations(
  subscription_synced,
  ({ one }) => ({
    profile: one(profile_synced, {
      fields: [subscription_synced.profile_id],
      references: [profile_synced.id]
    })
  })
);

// ====================================
// VIEWS
// ====================================

// Asset tag categories view - extracts distinct tag categories (part before ':') for each quest via asset tags
export const asset_tag_categories_synced = sqliteView(
  'asset_tag_categories_synced',
  {
    quest_id: text('quest_id').notNull(),
    tag_categories: text('tag_categories', { mode: 'json' }).$type<string[]>() // SQLite stores as comma-separated string
  }
).as(sql`
  SELECT
    q.id AS quest_id,
    GROUP_CONCAT(DISTINCT t.key) AS tag_categories
  FROM quest q
  JOIN quest_asset_link qal ON q.id = qal.quest_id
  JOIN asset a ON qal.asset_id = a.id
  JOIN asset_tag_link atl ON a.id = atl.asset_id
  JOIN tag t ON atl.tag_id = t.id
  GROUP BY q.id
  ORDER BY q.id
`);

// Quest tag categories view - extracts distinct tag categories for all quests in each project
export const quest_tag_categories_synced = sqliteView(
  'quest_tag_categories_synced',
  {
    project_id: text('project_id').notNull(),
    tag_categories: text('tag_categories', { mode: 'json' }).$type<string[]>() // SQLite stores as comma-separated string
  }
).as(sql`
  SELECT
    p.id AS project_id,
    GROUP_CONCAT(DISTINCT t.key) AS tag_categories
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

export const quest_closure_synced = createQuestClosureTable('synced', {
  quest: quest_synced,
  project: project_synced
});

export const quest_closure_syncedRelations = relations(
  quest_closure_synced,
  ({ one }) => ({
    quest: one(quest_synced, {
      fields: [quest_closure_synced.quest_id],
      references: [quest_synced.id]
    }),
    project: one(project_synced, {
      fields: [quest_closure_synced.project_id],
      references: [project_synced.id]
    })
  })
);

export const project_closure_synced = createProjectClosureTable('synced', {
  project: project_synced
});

export const project_closure_syncedRelations = relations(
  project_closure_synced,
  ({ one }) => ({
    project: one(project_synced, {
      fields: [project_closure_synced.project_id],
      references: [project_synced.id]
    })
  })
);

// Deprecated - remove after migration
export const quest_aggregates_synced = quest_closure_synced;
