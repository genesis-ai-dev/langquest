import { relations, sql } from 'drizzle-orm';
// import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { sqliteView, text } from 'drizzle-orm/sqlite-core';
import { APP_SCHEMA_VERSION } from './constants';
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
  createVoteTable,
  createAssetVoteTable
} from './drizzleSchemaColumns';

// NOTE: If you are using Drizzle with PowerSync and need to refer to the Postgres type for sync rules,
// see the official PowerSync documentation for the correct column types:
// https://docs.powersync.com/usage/sync-rules/types#types

export { APP_SCHEMA_VERSION };

export const profile = createProfileTable('merged');

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

export const language = createLanguageTable('merged', { profile });

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

export const project = createProjectTable('merged', { language, profile });

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
export const quest = createQuestTable('merged', {
  project,
  profile
});

export const questRelations = relations(quest, ({ one, many }) => ({
  project: one(project, {
    fields: [quest.project_id],
    references: [project.id]
  }),
  parent: one(quest, {
    fields: [quest.parent_id],
    references: [quest.id],
    relationName: 'quest_parent'
  }),
  children: many(quest, { relationName: 'quest_parent' }),
  tags: many(quest_tag_link),
  assets: many(quest_asset_link)
}));

export const tag = createTagTable('merged');

export const tagRelations = relations(tag, ({ many }) => ({
  quests: many(quest_tag_link),
  assets: many(asset_tag_link)
}));

export const quest_tag_link = createQuestTagLinkTable('merged', {
  quest,
  tag
});

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

export const asset = createAssetTable('merged', {
  language,
  project,
  profile
});

export const assetRelations = relations(asset, ({ one, many }) => ({
  source_language: one(language, {
    fields: [asset.source_language_id],
    references: [language.id]
  }),
  project: one(project, {
    fields: [asset.project_id],
    references: [project.id]
  }),
  source_asset: one(asset, {
    fields: [asset.source_asset_id],
    references: [asset.id],
    relationName: 'asset_source'
  }),
  children: many(asset, { relationName: 'asset_parent' }),
  tags: many(asset_tag_link),
  quests: many(quest_asset_link),
  content: many(asset_content_link),
  votes: many(vote)
}));

export const asset_tag_link = createAssetTagLinkTable('merged', {
  asset,
  tag
});

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

export const quest_asset_link = createQuestAssetLinkTable('merged', {
  quest,
  asset
});

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
export const project_language_link = createProjectLanguageLinkTable('merged', {
  project,
  language
});

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

export const reports = createReportsTable('merged', { profile });

export const blocked_users = createBlockedUsersTable('merged', { profile });

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

export const blocked_content = createBlockedContentTable('merged', { profile });

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
  asset: one(asset, {
    fields: [reports.record_id],
    references: [asset.id],
    relationName: 'asset_reports'
  })
}));

/**
 * @deprecated Use asset_vote instead. The vote table is being phased out in favor of asset_vote.
 * This table is kept temporarily for backwards compatibility but should no longer be used for new votes.
 */
export const vote = createVoteTable('merged', { asset, profile });

/**
 * @deprecated Use asset_voteRelations instead.
 */
export const voteRelations = relations(vote, ({ one }) => ({
  asset: one(asset, {
    fields: [vote.asset_id],
    references: [asset.id]
  }),
  creator: one(profile, {
    fields: [vote.creator_id],
    references: [profile.id]
  })
}));

/**
 * The asset_vote table is the new table for votes on assets.
 * This replaces the legacy vote table.
 */
export const asset_vote = createAssetVoteTable('merged', { asset, profile });

export const asset_voteRelations = relations(asset_vote, ({ one }) => ({
  asset: one(asset, {
    fields: [asset_vote.asset_id],
    references: [asset.id]
  }),
  creator: one(profile, {
    fields: [asset_vote.creator_id],
    references: [profile.id]
  })
}));

export const asset_content_link = createAssetContentLinkTable('merged', {
  asset,
  language
});

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

export const invite = createInviteTable('merged', {
  senderProfile: profile,
  receiverProfile: profile,
  project
});

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

export const request = createRequestTable('merged', {
  senderProfile: profile,
  project
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

export const notification = createNotificationTable('merged', { profile });

export const notificationRelations = relations(notification, ({ one }) => ({
  profile: one(profile, {
    fields: [notification.profile_id],
    references: [profile.id]
  })
}));

export const profile_project_link = createProfileProjectLinkTable('merged', {
  profile,
  project
});

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

export const subscription = createSubscriptionTable('merged', { profile });

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
export const quest_tag_categories = sqliteView('quest_tag_categories', {
  project_id: text('project_id').notNull(),
  tag_categories: text('tag_categories', { mode: 'json' }).$type<string[]>() // SQLite stores as comma-separated string
}).as(sql`
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

export const quest_closure = createQuestClosureTable('merged', {
  quest,
  project
});

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

export const project_closure = createProjectClosureTable('merged', {
  project
});

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
