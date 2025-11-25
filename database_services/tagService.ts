import { and, asc, eq, like } from 'drizzle-orm';
import { asset_tag_link, quest_tag_link, tag } from '../db/drizzleSchema';
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

  // async getTagsByTagKey(tagKey: string, limit = 200) {
  //   // First get tag IDs from junction table
  //   const tags = await db
  //     .select()
  //     .from(tag)
  //     .where(eq(tag.key, tagKey))
  //     .orderBy(asc(tag.value))
  //     .limit(limit);

  //   return tags;
  // }

  async searchTags(searchTerm?: string, limit = 200) {
    const whereCondition = searchTerm
      ? and(eq(tag.active, true), like(tag.key, `${searchTerm}%`))
      : eq(tag.active, true);

    console.log('Searching tags with condition:', searchTerm);
    const tags = await db
      .select()
      .from(tag)
      .where(whereCondition)
      .orderBy(asc(tag.key), asc(tag.value))
      .limit(limit);

    return tags;
  }

  async getAllActiveTags(limit = 200) {
    const tags = await db
      .select()
      .from(tag)
      .where(eq(tag.active, true))
      .orderBy(asc(tag.key))
      .limit(limit);

    return tags;
  }
}

export const tagService = new TagService();
