import { resolveTable } from '@/utils/dbUtils';
import { and, asc, eq, like } from 'drizzle-orm';
import { asset_tag_link, quest_tag_link, tag } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';
import { tagCache } from './tagCache';

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

  async preloadTagsIntoCache() {
    const tags = await db
      .select({ id: tag.id, key: tag.key, value: tag.value })
      .from(tag)
      .where(eq(tag.active, true))
      // .orderBy(asc(tag.key), asc(tag.value))
      .limit(20000);

    for (const tagRecord of tags) {
      tagCache.set(tagRecord.id, tagRecord);
    }
  }

  /**
   * Assigns a list of tags to an asset.
   * Deletes all existing tag assignments for the asset and creates new ones.
   * @param asset_id The ID of the asset
   * @param tag_ids Array of tag IDs to assign to the asset
   */
  async assignTagsToAssetLocal(asset_id: string, tag_ids: string[]) {
    try {
      // Start a transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        const contentLocal = resolveTable('asset_tag_link', {
          localOverride: true
        });
        // 1. Delete all existing tag assignments for this asset
        await tx
          .delete(contentLocal)
          .where(eq(contentLocal.asset_id, asset_id));

        // 2. Insert new tag assignments if any tag IDs are provided
        if (tag_ids.length > 0) {
          const newAssignments = tag_ids.map((tag_id) => ({
            asset_id,
            tag_id
          }));

          const newAssignmentsResult = await tx
            .insert(contentLocal)
            .values(newAssignments)
            .returning();
          console.log(
            `[TagService] New assignments result:`,
            newAssignmentsResult
          );
        }

        return { success: true, assigned_count: tag_ids.length };
      });

      console.log(
        `[TagService] Successfully assigned ${tag_ids.length} tags to asset ${asset_id}`
      );
      return result;
    } catch (error) {
      console.error(
        `[TagService] Failed to assign tags to asset ${asset_id}:`,
        error
      );
      throw new Error(
        `Failed to assign tags to asset: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export const tagService = new TagService();
