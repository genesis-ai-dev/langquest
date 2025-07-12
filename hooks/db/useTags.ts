import {
  asset_tag_categories,
  asset_tag_link,
  quest,
  quest_tag_categories,
  quest_tag_link,
  tag
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq, getTableColumns, like } from 'drizzle-orm';
import {
  useHybridSupabaseInfiniteQuery,
  useHybridSupabaseQuery
} from '../useHybridSupabaseQuery';

export type Tag = InferSelectModel<typeof tag>;

/**
 * Returns { tags, isLoading, error }
 * Fetches tags from Supabase (online) or local Drizzle DB (offline)
 */
export function useTags() {
  const { db } = system;

  const {
    data: tags,
    isLoading: isTagsLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['tags'],
    query: db.query.tag.findMany({
      where: eq(tag.active, true)
    })
  });

  return { tags, isTagsLoading, ...rest };
}

/**
 * Returns { tags, isLoading, error }
 * Fetches tags by quest ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useTagsByQuestId(quest_id: string) {
  const { db } = system;

  const {
    data: tags,
    isLoading: isTagsLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['tags', 'by-quest', quest_id],
    query: db
      .select({
        id: tag.id,
        name: tag.name,
        active: tag.active,
        created_at: tag.created_at,
        last_updated: tag.last_updated
      })
      .from(tag)
      .innerJoin(quest_tag_link, eq(tag.id, quest_tag_link.tag_id))
      .where(eq(quest_tag_link.quest_id, quest_id)),
    enabled: !!quest_id
  });

  return { tags, isTagsLoading, ...rest };
}

/**
 * Returns { tags, isLoading, error }
 * Fetches tags by asset ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useTagsByAssetId(asset_id: string) {
  const { db } = system;

  const {
    data: tags,
    isLoading: isTagsLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['tags', 'by-asset', asset_id],
    query: db
      .select({
        id: tag.id,
        name: tag.name,
        active: tag.active,
        created_at: tag.created_at,
        last_updated: tag.last_updated
      })
      .from(tag)
      .innerJoin(asset_tag_link, eq(tag.id, asset_tag_link.tag_id))
      .where(eq(asset_tag_link.asset_id, asset_id)),
    enabled: !!asset_id
  });

  return { tags, isTagsLoading, ...rest };
}

/**
 * Returns { tags, isLoading, error }
 * Fetches tags by project ID from Supabase (online) or local Drizzle DB (offline)
 * Gets all unique tags that belong to quests within the specified project
 * OPTIMIZED VERSION - uses direct joins instead of chunked requests
 */
export function useTagsByProjectId(project_id: string) {
  const { db, supabaseConnector } = system;

  const {
    data: tags,
    isLoading: isTagsLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['tags', 'by-project', project_id],
    onlineFn: async ({ signal }) => {
      // First get quest IDs for the project
      const { data: questIds, error: questError } =
        await supabaseConnector.client
          .from('quest')
          .select('id')
          .eq('project_id', project_id)
          .abortSignal(signal)
          .overrideTypes<{ id: string }[]>();

      if (questError) throw questError;
      if (!questIds.length) return [];

      // Split quest IDs into chunks to handle Supabase limits
      const questIdValues = questIds.map((q) => q.id);
      const chunkSize = 635;
      const chunks: string[][] = [];

      for (let i = 0; i < questIdValues.length; i += chunkSize) {
        chunks.push(questIdValues.slice(i, i + chunkSize));
      }

      // Make parallel requests for all chunks
      const chunkPromises = chunks.map((chunk) =>
        supabaseConnector.client
          .from('quest_tag_link')
          .select('tag:tag_id(*)')
          .in('quest_id', chunk)
          .abortSignal(signal)
          .overrideTypes<{ tag: Tag }[]>()
      );

      const results = await Promise.allSettled(chunkPromises);

      // Check for any failures
      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length > 0) {
        throw new Error(`Failed to fetch tags for ${failures.length} chunks`);
      }

      // Extract unique tags efficiently from all successful results
      const tagMap = new Map<string, Tag>();
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.data) {
          result.value.data.forEach((item) => {
            tagMap.set(item.tag.id, item.tag);
          });
        }
      });

      return Array.from(tagMap.values());
    },
    offlineQuery: db
      .selectDistinct({
        ...getTableColumns(tag)
      })
      .from(tag)
      .innerJoin(quest_tag_link, eq(tag.id, quest_tag_link.tag_id))
      .innerJoin(quest, eq(quest_tag_link.quest_id, quest.id))
      .where(eq(quest.project_id, project_id)),
    enabled: !!project_id
  });

  return { tags, isTagsLoading, ...rest };
}

/**
 * Returns { tagCategories, isLoading, error }
 * Fetches tag categories by quest ID using the asset_tag_categories view
 * This is more efficient for getting just the categories without individual tag details
 */
export function useTagCategoriesByQuestId(quest_id: string) {
  const { db, supabaseConnector } = system;

  const {
    data: tagCategories,
    isLoading: isTagCategoriesLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['tag-categories', 'by-quest', quest_id],
    onlineFn: async ({ signal }) => {
      // Use the optimized view for getting categories
      const { data, error } = await supabaseConnector.client
        .from('asset_tag_categories')
        .select('tag_categories')
        .eq('quest_id', quest_id)
        .abortSignal(signal)
        .single()
        .overrideTypes<{ tag_categories: string[] | null }>();

      if (error) throw error;

      return [data];
    },
    offlineQuery: db
      .select({
        tag_categories: asset_tag_categories.tag_categories
      })
      .from(asset_tag_categories)
      .where(eq(asset_tag_categories.quest_id, quest_id)),
    gcTime: 0,
    staleTime: 0,
    enabled: !!quest_id
  });

  return {
    tagCategories: tagCategories[0],
    isTagCategoriesLoading,
    ...rest
  };
}

/**
 * Returns { tagCategories, isLoading, error }
 * Fetches tag categories by project ID using the quest_tag_categories view
 * This is more efficient for getting just the categories without individual tag details
 */
export function useTagCategoriesByProjectId(project_id: string) {
  const { db, supabaseConnector } = system;

  const {
    data: tagCategories,
    isLoading: isTagCategoriesLoading,
    ...rest
  } = useHybridSupabaseQuery({
    queryKey: ['tag-categories', 'by-project', project_id],
    onlineFn: async ({ signal }) => {
      // Use the optimized view for getting categories
      const { data, error } = await supabaseConnector.client
        .from('quest_tag_categories')
        .select('tag_categories')
        .eq('project_id', project_id)
        .abortSignal(signal)
        .single()
        .overrideTypes<{ tag_categories: string[] | null }>();

      if (error) throw error;

      return [data];
    },
    offlineQuery: db
      .select({
        tag_categories: quest_tag_categories.tag_categories
      })
      .from(quest_tag_categories)
      .where(eq(quest_tag_categories.project_id, project_id)),
    gcTime: 0,
    staleTime: 0,
    enabled: !!project_id
  });

  return {
    tagCategories: tagCategories[0],
    isTagCategoriesLoading,
    ...rest
  };
}

/**
 * Returns { tags, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage }
 * Fetches tags by project ID with infinite scrolling
 * Gets all unique tags that belong to quests within the specified project
 */
export function useInfiniteTagsByProjectId(project_id: string) {
  const { db, supabaseConnector } = system;

  return useHybridSupabaseInfiniteQuery<Tag>({
    queryKey: ['tags', 'by-project-paginated', project_id],
    onlineFn: async ({ pageParam, pageSize }) => {
      // Use direct pagination approach with tags
      const { data, error } = await supabaseConnector.client
        .from('tag')
        .select(
          `
          id,
          name,
          active,
          created_at,
          last_updated,
          download_profiles,
          quest_tag_link!inner(
            quest(
              project_id
            )
          )
        `
        )
        .eq('quest_tag_link.quest.project_id', project_id)
        .eq('active', true)
        .order('name')
        .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1)
        .overrideTypes<Tag[]>();

      if (error) throw error;
      console.log('data', 'test');
      console.log('data', data.length);
      return data;
    },
    offlineFn: async ({ pageParam, pageSize }) => {
      return await db
        .selectDistinct({
          ...getTableColumns(tag)
        })
        .from(tag)
        .innerJoin(quest_tag_link, eq(tag.id, quest_tag_link.tag_id))
        .innerJoin(quest, eq(quest_tag_link.quest_id, quest.id))
        .where(eq(quest.project_id, project_id))
        .limit(pageSize)
        .offset(pageParam * pageSize)
        .orderBy(tag.name);
    },
    enabled: !!project_id,
    pageSize: 10
  });
}

/**
 * Returns { tags, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage }
 * Fetches tags by quest ID with infinite scrolling
 * Gets all unique tags that belong to the specified quest
 */
export function useInfiniteTagsByQuestId(quest_id: string) {
  const { db, supabaseConnector } = system;

  return useHybridSupabaseInfiniteQuery<Tag>({
    queryKey: ['tags', 'by-quest-paginated', quest_id],
    onlineFn: async ({ pageParam, pageSize }) => {
      // Use direct pagination approach with tags
      const { data, error } = await supabaseConnector.client
        .from('tag')
        .select(
          `
          id,
          name,
          active,
          created_at,
          last_updated,
          download_profiles,
          quest_tag_link!inner(
            quest_id
          )
        `
        )
        .eq('quest_tag_link.quest_id', quest_id)
        .eq('active', true)
        .order('name')
        .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1)
        .overrideTypes<Tag[]>();

      if (error) throw error;
      return data;
    },
    offlineFn: async ({ pageParam, pageSize }) => {
      return await db
        .select({
          ...getTableColumns(tag)
        })
        .from(tag)
        .innerJoin(quest_tag_link, eq(tag.id, quest_tag_link.tag_id))
        .where(eq(quest_tag_link.quest_id, quest_id))
        .limit(pageSize)
        .offset(pageParam * pageSize)
        .orderBy(tag.name);
    },
    enabled: !!quest_id,
    pageSize: 50
  });
}

/**
 * Returns { tags, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage }
 * Fetches tags by quest ID and category with infinite scrolling
 * Gets tags that belong to the specified quest and match the category
 */
export function useInfiniteTagsByQuestIdAndCategory(
  quest_id: string,
  category: string
) {
  const { db, supabaseConnector } = system;

  return useHybridSupabaseInfiniteQuery<Tag>({
    queryKey: ['tags', 'by-quest-category-paginated', quest_id, category],
    onlineFn: async ({ pageParam, pageSize }) => {
      // Use direct pagination approach with tags filtered by category
      const { data, error } = await supabaseConnector.client
        .from('tag')
        .select(
          `
          id,
          name,
          active,
          created_at,
          last_updated,
          download_profiles,
          quest_tag_link!inner(
            quest_id
          )
        `
        )
        .eq('quest_tag_link.quest_id', quest_id)
        .eq('active', true)
        .like('name', `${category}:%`)
        .order('name')
        .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1)
        .overrideTypes<Tag[]>();

      if (error) throw error;
      return data;
    },
    offlineFn: async ({ pageParam, pageSize }) => {
      const data = await db
        .select({
          ...getTableColumns(tag)
        })
        .from(tag)
        .innerJoin(quest_tag_link, eq(tag.id, quest_tag_link.tag_id))
        .where(
          and(
            eq(quest_tag_link.quest_id, quest_id),
            like(tag.name, `${category}:%`)
          )
        )
        .limit(pageSize)
        .offset(pageParam * pageSize)
        .orderBy(tag.name);

      console.log('data', data);
      return data;
    },
    enabled: !!quest_id && !!category,
    pageSize: 20
  });
}

/**
 * Returns { tags, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage }
 * Fetches tags by project ID and category with infinite scrolling
 * Gets tags that belong to quests within the specified project and match the category
 */
export function useInfiniteTagsByProjectIdAndCategory(
  project_id: string,
  category: string
) {
  const { db, supabaseConnector } = system;

  return useHybridSupabaseInfiniteQuery<Tag>({
    queryKey: ['tags', 'by-project-category-paginated', project_id, category],
    onlineFn: async ({ pageParam, pageSize }) => {
      // Use direct pagination approach with tags filtered by category
      const { data, error } = await supabaseConnector.client
        .from('tag')
        .select(
          `
          id,
          name,
          active,
          created_at,
          last_updated,
          download_profiles,
          quest_tag_link!inner(
            quest(
              project_id
            )
          )
        `
        )
        .eq('quest_tag_link.quest.project_id', project_id)
        .eq('active', true)
        .like('name', `${category}:%`)
        .order('name')
        .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1)
        .overrideTypes<Tag[]>();

      if (error) throw error;
      return data;
    },
    offlineFn: async ({ pageParam, pageSize }) => {
      return await db
        .selectDistinct({
          ...getTableColumns(tag)
        })
        .from(tag)
        .innerJoin(quest_tag_link, eq(tag.id, quest_tag_link.tag_id))
        .innerJoin(quest, eq(quest_tag_link.quest_id, quest.id))
        .where(
          and(eq(quest.project_id, project_id), like(tag.name, `${category}:%`))
        )
        .limit(pageSize)
        .offset(pageParam * pageSize)
        .orderBy(tag.name);
    },
    enabled: !!project_id && !!category,
    pageSize: 20
  });
}
