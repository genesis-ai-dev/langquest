import { int, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

// Create a type from your actual icon files
type IconName = `${string}.png`; // Matches any .png filename

const uuidDefault = sql`(lower(hex(randomblob(16))))`;
const timestampDefault = sql`(CURRENT_TIMESTAMP)`;

const linkColumns = {
  active: int({ mode: 'boolean' }).notNull().default(true),
  created_at: text().notNull().default(timestampDefault),
  last_updated: text()
    .notNull()
    .default(timestampDefault)
    .$onUpdate(() => timestampDefault)
};

// Base columns that most tables will have
const baseColumns = {
  id: text()
    .primaryKey()
    .$defaultFn(() => uuidDefault),
  ...linkColumns
};

export const profile = sqliteTable('profile', {
  ...baseColumns,
  username: text(),
  password: text(),
  avatar: text(),
  // icon: text().$type<IconName>(),
  // achievements: text(),
  ui_language_id: text()
});

export const userRelations = relations(profile, ({ many, one }) => ({
  created_languages: many(language, { relationName: 'creator' }),
  ui_language: one(language, {
    fields: [profile.ui_language_id],
    references: [language.id],
    relationName: 'uiLanguage'
  })
}));

export const language = sqliteTable('language', {
  ...baseColumns,
  // Enforce the existence of either native_name or english_name in the app
  native_name: text(), // Enforce uniqueness across chains in the app
  english_name: text(), // Enforce uniqueness across chains in the app
  iso639_3: text(), // Enforce uniqueness across chains in the app
  ui_ready: int({ mode: 'boolean' }).notNull(),
  creator_id: text().references(() => profile.id)
});

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

export const project = sqliteTable('project', {
  ...baseColumns,
  name: text().notNull(),
  description: text(),
  source_language_id: text()
    .notNull()
    .references(() => language.id),
  target_language_id: text()
    .notNull()
    .references(() => language.id)
});

export const projectRelations = relations(project, ({ one }) => ({
  source_language: one(language, {
    fields: [project.source_language_id],
    references: [language.id],
    relationName: 'sourceLanguage'
  }),
  target_language: one(language, {
    fields: [project.target_language_id],
    references: [language.id],
    relationName: 'targetLanguage'
  })
}));

export const quest = sqliteTable('quest', {
  ...baseColumns,
  name: text().notNull(),
  description: text(),
  project_id: text()
    .notNull()
    .references(() => project.id)
});

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
  (t) => ({
    pk: primaryKey({ columns: [t.quest_id, t.tag_id] })
  })
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

export const asset = sqliteTable('asset', {
  ...baseColumns,
  name: text().notNull(),
  source_language_id: text()
    .notNull()
    .references(() => language.id),
  images: text({ mode: 'json' }).$type<string[]>()
});

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
  (t) => ({
    pk: primaryKey({ columns: [t.asset_id, t.tag_id] })
  })
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
  (t) => ({
    pk: primaryKey({ columns: [t.quest_id, t.asset_id] })
  })
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

export const translation = sqliteTable('translation', {
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
    .references(() => profile.id)
});

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
  votes: many(vote)
}));

export const vote = sqliteTable('vote', {
  ...baseColumns,
  translation_id: text()
    .notNull()
    .references(() => translation.id),
  polarity: text({ enum: ['up', 'down'] }).notNull(),
  comment: text(),
  creator_id: text()
    .notNull()
    .references(() => profile.id)
});

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

export const asset_content_link = sqliteTable('asset_content_link', {
  ...baseColumns,
  asset_id: text()
    .notNull()
    .references(() => asset.id),
  text: text().notNull(),
  audio_id: text() // Optional since text content might not have an associated file
});

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
    profile_id: text().notNull(),
    project_id: text().notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.profile_id, t.project_id] })
  })
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
    profile_id: text().notNull(),
    quest_id: text().notNull() // Changed from project_id to quest_id
  },
  (t) => ({
    pk: primaryKey({ columns: [t.profile_id, t.quest_id] })
  })
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
    profile_id: text().notNull(),
    asset_id: text().notNull() // Changed from project_id to asset_id
  },
  (t) => ({
    pk: primaryKey({ columns: [t.profile_id, t.asset_id] })
  })
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

// export const notification = sqliteTable('notification', {
//   ...baseColumns,
//   id: text().notNull(),
//   profile_id: text().notNull(),
//   project_subscription_id: text().notNull(),
//   quest_subscription_id: text().notNull(),
//   asset_subscription_id: text().notNull(),
//   translation_subscription_id: text().notNull(),
//   invite_request_id: text().notNull(),
//   event_type: text().notNull(),
//   viewed: int({ mode: 'boolean' }).notNull()
// });

// export const notificationRelations = relations(notification, ({ one }) => ({
//   profile: one(profile, {
//     fields: [notification.profile_id],
//     references: [profile.id]
//   }),
//   project_subscription: one(project_subscription, {
//     fields: [notification.project_subscription_id],
//     references: [project_subscription.id]
//   }),
//   quest_subscription: one(quest_subscription, {
//     fields: [notification.quest_subscription_id],
//     references: [quest_subscription.id]
//   }),
//   asset_subscription: one(asset_subscription, {
//     fields: [notification.asset_subscription_id],
//     references: [asset_subscription.id]
//   }),
//   translation_subscription: one(translation_subscription, {
//     fields: [notification.translation_subscription_id],
//     references: [translation_subscription.id]
//   }),
//   invite_request: one(invite_request, {
//     fields: [notification.invite_request_id],
//     references: [invite_request.id]
//   })
// }));

// export const translation_subscription = sqliteTable(
//   'translation_subscription',
//   {
//     ...baseColumns,
//     translation_id: text().notNull(),
//     profile_id: text().notNull()
//   }
// );

// export const translationSubscriptionRelations = relations(
//   translation_subscription,
//   ({ one, many }) => ({
//     translation: one(translation, {
//       fields: [translation_subscription.translation_id],
//       references: [translation.id]
//     }),
//     profile: one(profile, {
//       fields: [translation_subscription.profile_id],
//       references: [profile.id]
//     }),
//     notifications: many(notification)
//   })
// );

// export const project_subscription = sqliteTable('project_subscription', {
//   ...baseColumns,
//   project_id: text().notNull(),
//   profile_id: text().notNull()
// });

// export const projectSubscriptionRelations = relations(
//   project_subscription,
//   ({ one, many }) => ({
//     project: one(project, {
//       fields: [project_subscription.project_id],
//       references: [project.id]
//     }),
//     profile: one(profile, {
//       fields: [project_subscription.profile_id],
//       references: [profile.id]
//     }),
//     quest_subscriptions: many(quest_subscription),
//     notifications: many(notification)
//   })
// );

// export const quest_subscription = sqliteTable('quest_subscription', {
//   ...baseColumns,
//   quest_id: text().notNull(),
//   project_subscription_id: text().notNull()
// });

// export const questSubscriptionRelations = relations(
//   quest_subscription,
//   ({ one, many }) => ({
//     quest: one(quest, {
//       fields: [quest_subscription.quest_id],
//       references: [quest.id]
//     }),
//     project_subscription: one(project_subscription, {
//       fields: [quest_subscription.project_subscription_id],
//       references: [project_subscription.id]
//     }),
//     asset_subscriptions: many(asset_subscription),
//     notifications: many(notification)
//   })
// );

// export const asset_subscription = sqliteTable('asset_subscription', {
//   ...baseColumns,
//   asset_id: text().notNull(),
//   quest_subscription_id: text().notNull()
// });

// export const assetSubscriptionRelations = relations(
//   asset_subscription,
//   ({ one, many }) => ({
//     asset: one(asset, {
//       fields: [asset_subscription.asset_id],
//       references: [asset.id]
//     }),
//     quest_subscription: one(quest_subscription, {
//       fields: [asset_subscription.quest_subscription_id],
//       references: [quest_subscription.id]
//     }),
//     notifications: many(notification)
//   })
// );

// export const invite_request = sqliteTable('invite_request', {
//   ...baseColumns,
//   sender_profile_id: text().notNull(),
//   receiver_profile_id: text().notNull(),
//   project_id: text().notNull(),
//   type: text({ enum: ['invite', 'request'] }).notNull(),
//   status: text({
//     enum: ['pending', 'rejected', 'approved', 'cancelled']
//   }).notNull()
// });

// export const inviteRequestRelations = relations(
//   invite_request,
//   ({ one, many }) => ({
//     sender: one(profile, {
//       fields: [invite_request.sender_profile_id],
//       references: [profile.id]
//     }),
//     receiver: one(profile, {
//       fields: [invite_request.receiver_profile_id],
//       references: [profile.id]
//     }),
//     project: one(project, {
//       fields: [invite_request.project_id],
//       references: [project.id]
//     }),
//     notifications: many(notification)
//   })
// );
