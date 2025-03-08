import { eq } from 'drizzle-orm';
import { tag, quest_tag_link, asset_tag_link } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type Tag = typeof tag.$inferSelect;

const { db } = system;

export class TagService {
  async getTagsByQuestId(quest_id: string) {
    // First get tag IDs from junction table
    const tagLinks = await db
      .select({
        tag_id: quest_tag_link.tag_id
      })
      .from(quest_tag_link)
      .where(eq(quest_tag_link.quest_id, quest_id));

    // Then get the actual tags
    const tagPromises = tagLinks.map((link) =>
      db
        .select()
        .from(tag)
        .where(eq(tag.id, link.tag_id))
        .then((results) => results[0])
    );

    return Promise.all(tagPromises);
  }

  async getTagsByAssetId(asset_id: string) {
    // First get tag IDs from junction table
    const tagLinks = await db
      .select({
        tag_id: asset_tag_link.tag_id
      })
      .from(asset_tag_link)
      .where(eq(asset_tag_link.asset_id, asset_id));

    // Then get the actual tags
    const tagPromises = tagLinks.map((link) =>
      db
        .select()
        .from(tag)
        .where(eq(tag.id, link.tag_id))
        .then((results) => results[0])
    );

    return Promise.all(tagPromises);
  }
}

export const tagService = new TagService();
