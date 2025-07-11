import { asset_tag_link, quest_tag_link, tag } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { useHybridQuery } from '../useHybridQuery';

export type Tag = InferSelectModel<typeof tag>;

/**
 * Returns { tags, isLoading, error }
 * Fetches tags from Supabase (online) or local Drizzle DB (offline)
 */
export function useTags() {
  const { db, supabaseConnector } = system;

  const {
    data: tags,
    isLoading: isTagsLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['tags'],
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('tag')
        .select('*')
        .eq('active', true)
        .overrideTypes<Tag[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.tag.findMany({
        where: eq(tag.active, true)
      })
    )
  });

  return { tags, isTagsLoading, ...rest };
}

/**
 * Returns { tags, isLoading, error }
 * Fetches tags by quest ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useTagsByQuestId(quest_id: string) {
  const { db, supabaseConnector } = system;

  const {
    data: tags,
    isLoading: isTagsLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['tags', 'by-quest', quest_id],
    onlineFn: async () => {
      // Get tags through junction table
      const { data, error } = await supabaseConnector.client
        .from('quest_tag_link')
        .select(
          `
          tag:tag_id (
            id,
            name,
            active,
            created_at,
            last_updated
          )
        `
        )
        .eq('quest_id', quest_id)
        .overrideTypes<{ tag: Tag }[]>();

      if (error) throw error;
      return data.map((item) => item.tag).filter(Boolean);
    },
    offlineQuery: toCompilableQuery(
      db
        .select({
          id: tag.id,
          name: tag.name,
          active: tag.active,
          created_at: tag.created_at,
          last_updated: tag.last_updated
        })
        .from(tag)
        .innerJoin(quest_tag_link, eq(tag.id, quest_tag_link.tag_id))
        .where(eq(quest_tag_link.quest_id, quest_id))
    ),
    enabled: !!quest_id
  });

  return { tags, isTagsLoading, ...rest };
}

/**
 * Returns { tags, isLoading, error }
 * Fetches tags by asset ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useTagsByAssetId(asset_id: string) {
  const { db, supabaseConnector } = system;

  const {
    data: tags,
    isLoading: isTagsLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['tags', 'by-asset', asset_id],
    onlineFn: async () => {
      // Get tags through junction table
      const { data, error } = await supabaseConnector.client
        .from('asset_tag_link')
        .select(
          `
          tag:tag_id (
            id,
            name,
            active,
            created_at,
            last_updated
          )
        `
        )
        .eq('asset_id', asset_id)
        .overrideTypes<{ tag: Tag }[]>();

      if (error) throw error;
      return data.map((item) => item.tag).filter(Boolean);
    },
    offlineQuery: toCompilableQuery(
      db
        .select({
          id: tag.id,
          name: tag.name,
          active: tag.active,
          created_at: tag.created_at,
          last_updated: tag.last_updated
        })
        .from(tag)
        .innerJoin(asset_tag_link, eq(tag.id, asset_tag_link.tag_id))
        .where(eq(asset_tag_link.asset_id, asset_id))
    ),
    enabled: !!asset_id
  });

  return { tags, isTagsLoading, ...rest };
}
