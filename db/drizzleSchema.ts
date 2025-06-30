import { relations, sql } from 'drizzle-orm';
import {
  index,
  int,
  primaryKey,
  sqliteTable,
  text
} from 'drizzle-orm/sqlite-core';
import { reasonOptions } from './constants';

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
    creator_id: text().references(() => profile.id)
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
    source_language_id: text()
      .notNull()
      .references(() => language.id),
    target_language_id: text()
      .notNull()
      .references(() => language.id),
    creator_id: text().references(() => profile.id),
    private: int({ mode: 'boolean' }).notNull().default(false),
    visible: int({ mode: 'boolean' }).notNull().default(true)
  },
  (table) => [
    index('name_idx').on(table.name),
    index('source_language_id_idx').on(table.source_language_id),
    index('target_language_id_idx').on(table.target_language_id)
  ]
);

export const projectRelations = relations(project, ({ one, many }) => ({
  source_language: one(language, {
    fields: [project.source_language_id],
    references: [language.id],
    relationName: 'sourceLanguage'
  }),
  target_language: one(language, {
    fields: [project.target_language_id],
    references: [language.id],
    relationName: 'targetLanguage'
  }),
  quests: many(quest),
  profile_project_links: many(profile_project_link),
  invites: many(invite),
  requests: many(request)
}));
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
    visible: int({ mode: 'boolean' }).notNull().default(true)
  },
  (table) => [
    index('project_id_idx').on(table.project_id),
    index('name_idx').on(table.name),
    index('project_id_name_idx').on(table.project_id, table.name),
    index('project_id_visible_idx').on(table.project_id, table.visible)
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
  name: text().notNull()
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
    tag_id: text().notNull()
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
    visible: int({ mode: 'boolean' }).notNull().default(true)
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
    tag_id: text().notNull()
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
    asset_id: text().notNull()
  },
  (t) => [
    primaryKey({ columns: [t.quest_id, t.asset_id] }),
    index('quest_id_idx').on(t.quest_id),
    index('asset_id_idx').on(t.asset_id)
  ]
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
    visible: int({ mode: 'boolean' }).notNull().default(true)
  },
  (t) => [
    index('asset_id_idx').on(t.asset_id),
    index('creator_id_idx').on(t.creator_id),
    index('asset_id_visible_idx').on(t.asset_id, t.visible)
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
      .references(() => profile.id)
  },
  (t) => [
    index('translation_id_idx').on(t.translation_id),
    index('creator_id_idx').on(t.creator_id),
    index('translation_id_creator_id_idx').on(t.translation_id, t.creator_id),
    index('translation_id_polarity_idx').on(t.translation_id, t.polarity)
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
    text: text().notNull(),
    audio_id: text()
  },
  (t) => [index('asset_id_idx').on(t.asset_id)]
);

export const asset_content_linkRelations = relations(
  asset_content_link,
  ({ one }) => ({
    asset: one(asset, {
      fields: [asset_content_link.asset_id],
      references: [asset.id]
    })
  })
);

export const project_download = sqliteTable(
  'project_download',
  {
    ...linkColumns,
    profile_id: text()
      .notNull()
      .references(() => profile.id),
    project_id: text()
      .notNull()
      .references(() => project.id)
  },
  (t) => [
    primaryKey({ columns: [t.profile_id, t.project_id] }),
    index('profile_id_idx').on(t.profile_id)
  ]
);

export const project_downloadRelations = relations(
  project_download,
  ({ one }) => ({
    profile: one(profile, {
      fields: [project_download.profile_id],
      references: [profile.id]
    }),
    project: one(project, {
      fields: [project_download.project_id],
      references: [project.id]
    })
  })
);

export const quest_download = sqliteTable(
  'quest_download',
  {
    ...linkColumns,
    profile_id: text()
      .notNull()
      .references(() => profile.id),
    quest_id: text()
      .notNull()
      .references(() => quest.id)
  },
  (t) => [
    primaryKey({ columns: [t.profile_id, t.quest_id] }),
    index('profile_id_idx').on(t.profile_id)
  ]
);

export const quest_downloadRelations = relations(quest_download, ({ one }) => ({
  profile: one(profile, {
    fields: [quest_download.profile_id],
    references: [profile.id]
  }),
  quest: one(quest, {
    fields: [quest_download.quest_id],
    references: [quest.id]
  })
}));

export const asset_download = sqliteTable(
  'asset_download',
  {
    ...linkColumns,
    profile_id: text()
      .notNull()
      .references(() => profile.id),
    asset_id: text()
      .notNull()
      .references(() => asset.id)
  },
  (t) => [
    primaryKey({ columns: [t.profile_id, t.asset_id] }),
    index('profile_id_idx').on(t.profile_id)
  ]
);

export const asset_downloadRelations = relations(asset_download, ({ one }) => ({
  profile: one(profile, {
    fields: [asset_download.profile_id],
    references: [profile.id]
  }),
  asset: one(asset, {
    fields: [asset_download.asset_id],
    references: [asset.id]
  })
}));

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
    status: text().notNull(),
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
  status: text().notNull(),
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
