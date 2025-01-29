import { column, Schema, Table } from '@powersync/react-native';

const baseColumns = {
  // id: column.text,???
  rev: column.integer,
  created_at: column.text,
  last_updated: column.text,
  version_chain_id: column.text
};

const profile = new Table({
  ...baseColumns,
  username: column.text,
  password: column.text,
  // icon: column.text,
  // achievements: column.text,
  ui_language_id: column.text
});

const language = new Table({
  ...baseColumns,
  native_name: column.text,
  english_name: column.text,
  iso639_3: column.text,
  ui_ready: column.integer,
  creator_id: column.text
});

const project = new Table({
  ...baseColumns,
  name: column.text,
  description: column.text,
  source_language_id: column.text,
  target_language_id: column.text
});

const quest = new Table({
  ...baseColumns,
  name: column.text,
  description: column.text,
  project_id: column.text
});

const tag = new Table({
  ...baseColumns,
  name: column.text
});

const quest_tag_link = new Table(
  {
    quest_id: column.text,
    tag_id: column.text
  },
  {
    indexes: {
      pk: ['quest_id', 'tag_id']
    }
  }
);

const asset = new Table({
  ...baseColumns,
  name: column.text,
  source_language_id: column.text,
  text: column.text,
  images: column.text,
  audio: column.text
});

const asset_tag_link = new Table(
  {
    asset_id: column.text,
    tag_id: column.text
  },
  {
    indexes: {
      pk: ['asset_id', 'tag_id']
    }
  }
);

const quest_asset_link = new Table(
  {
    quest_id: column.text,
    asset_id: column.text
  },
  {
    indexes: {
      pk: ['quest_id', 'asset_id']
    }
  }
);

const translation = new Table({
  ...baseColumns,
  asset_id: column.text,
  target_language_id: column.text,
  text: column.text,
  audio: column.text,
  creator_id: column.text
});

const vote = new Table({
  ...baseColumns,
  translation_id: column.text,
  polarity: column.text,
  comment: column.text,
  creator_id: column.text
});

const notification = new Table({
  ...baseColumns,
  profile_id: column.text,
  project_subscription_id: column.text,
  quest_subscription_id: column.text,
  asset_subscription_id: column.text,
  translation_subscription_id: column.text,
  invite_request_id: column.text,
  event_type: column.text,
  viewed: column.integer
});

const translation_subscription = new Table({
  ...baseColumns,
  translation_id: column.text,
  profile_id: column.text
});

const project_subscription = new Table({
  ...baseColumns,
  project_id: column.text,
  profile_id: column.text
});

const quest_subscription = new Table({
  ...baseColumns,
  quest_id: column.text,
  project_subscription_id: column.text
});

const asset_subscription = new Table({
  ...baseColumns,
  asset_id: column.text,
  quest_subscription_id: column.text
});

const invite_request = new Table({
  ...baseColumns,
  sender_profile_id: column.text,
  receiver_profile_id: column.text,
  project_id: column.text,
  type: column.text,
  status: column.text
});

export const AppSchema = new Schema({
  profile,
  language,
  project,
  quest,
  tag,
  quest_tag_link,
  asset,
  asset_tag_link,
  quest_asset_link,
  translation,
  vote,
  notification,
  translation_subscription,
  project_subscription,
  quest_subscription,
  asset_subscription,
  invite_request
});
