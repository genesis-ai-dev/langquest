import { tag } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { eq, inArray } from 'drizzle-orm';
import { create } from 'zustand';
import type { Tag } from '../database_services/tagCache';
import { tagCache } from '../database_services/tagCache';

export type { Tag };

interface TagStore {
  getTag: (id: string) => Tag | undefined;
  getManyTags: (ids: string[]) => Tag[];
  fetchTag: (id: string) => Promise<Tag | undefined>;
  fetchManyTags: (ids: string[]) => Promise<Tag[]>;
}

export const useTagStore = create<TagStore>(() => ({
  // Sync version - uses cache only
  getTag: (id) => tagCache.get(id),

  // Sync version - uses cache only
  getManyTags: (ids) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!ids || ids.length === 0) return [];

    return ids.map((id) => tagCache.get(id)).filter(Boolean);
  },

  // Async version - fetches from database
  fetchTag: async (id) => {
    // Check cache first
    const cached = tagCache.get(id);
    if (cached) return cached;

    // Fetch from database
    const results = await system.db
      .select({ id: tag.id, key: tag.key, value: tag.value })
      .from(tag)
      .where(eq(tag.id, id))
      .limit(1);

    const result = results[0];
    if (result) {
      // Store in cache for future use
      tagCache.set(result.id, result);
    }
    return result;
  },

  // Async version - fetches from database
  fetchManyTags: async (ids) => {
    if (ids.length === 0) return [];

    // Filter out IDs already in cache
    const cachedTags: Tag[] = [];
    const missingIds: string[] = [];

    for (const id of ids) {
      const cached = tagCache.get(id);
      if (cached) {
        cachedTags.push(cached);
      } else {
        missingIds.push(id);
      }
    }

    // If all tags are cached, return them
    if (missingIds.length === 0) {
      return cachedTags;
    }

    // Fetch missing tags from database
    const fetchedTags = await system.db
      .select({ id: tag.id, key: tag.key, value: tag.value })
      .from(tag)
      .where(inArray(tag.id, missingIds));

    // Store fetched tags in cache
    for (const fetchedTag of fetchedTags) {
      tagCache.set(fetchedTag.id, fetchedTag);
    }

    // Return all tags (cached + fetched)
    return [...cachedTags, ...fetchedTags];
  }
}));
