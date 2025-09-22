import type { translation, vote } from '@/db/drizzleSchema';
import {
  asset,
  asset_content_link,
  asset_tag_link,
  quest,
  quest_asset_link,
  tag
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { WithSource } from '@/utils/dbUtils';
import { mergeQuery } from '@/utils/dbUtils';
import { getOptionShowHiddenContent } from '@/utils/settingsUtils';
import {
  hybridFetch,
  useSimpleHybridInfiniteData
} from '@/views/new/useHybridData';
import { toMergeCompilableQuery } from '@/utils/dbUtils';
import type { InferSelectModel, SQL } from 'drizzle-orm';
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
  like,
  notInArray,
  or,
  sql
} from 'drizzle-orm';
import { useMemo } from 'react';
import {
  createHybridQueryConfig,
  useHybridInfiniteQuery,
  useHybridQuery
} from '../useHybridQuery';
import { useUserRestrictions } from './useBlocks';
import type { Tag } from './useTags';

export type Asset = InferSelectModel<typeof asset>;
export type QuestAssetLink = InferSelectModel<typeof quest_asset_link>;
export type AssetContent = InferSelectModel<typeof asset_content_link>;
export type Translation = InferSelectModel<typeof translation>;
export type Vote = InferSelectModel<typeof vote>;

/**
 * Returns a single asset by ID using hybrid fetch
 */

export async function getAssetById(asset_id: string) {
  const assets = await hybridFetch<Asset>({
    offlineQuery: toMergeCompilableQuery(
      system.db.query.asset.findMany({
        where: eq(asset.id, asset_id)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset')
        .select('*')
        .eq('id', asset_id)
        .overrideTypes<(Omit<Asset, 'images'> & { images: string })[]>();
      if (error) throw error;

      return data.map((asset) => ({
        ...asset,
        images: JSON.parse(asset.images) as Asset['images']
      }));
    }
  });

  return assets[0];
}

export function useAssetById(asset_id: string | undefined) {
  const { db, supabaseConnector } = system;

  // Main query using hybrid query
  const {
    data: assetArray,
    isLoading: isAssetLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['asset', asset_id],
    enabled: !!asset_id,
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('asset')
        .select('*')
        .eq('id', asset_id)
        .limit(1)
        .overrideTypes<Asset[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toMergeCompilableQuery(
      db.query.asset.findMany({
        where: (fields, { eq }) => eq(fields.id, asset_id!),
        limit: 1
      })
    )
  });

  const asset = assetArray[0] || null;

  return { asset, isAssetLoading, ...rest };
}

export function getAssetsById(asset_ids: string[]) {
  return hybridFetch<Asset>({
    offlineQuery: toMergeCompilableQuery(
      system.db.query.asset.findMany({
        where: inArray(asset.id, asset_ids)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset')
        .select('*')
        .in('id', asset_ids)
        .overrideTypes<(Omit<Asset, 'images'> & { images: string })[]>();
      if (error) throw error;

      return data.map((asset) => ({
        ...asset,
        images: JSON.parse(asset.images) as Asset['images']
      }));
    }
  });
}

/**
 * Returns { assetContent, isLoading, error }
 * Fetches asset content by asset ID from Supabase (online) or local Drizzle DB (offline)
 */

function getAssetContentConfig(asset_id: string) {
  return createHybridQueryConfig({
    queryKey: ['asset-content', asset_id],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset_content_link')
        .select('*')
        .eq('asset_id', asset_id)
        .overrideTypes<AssetContent[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toMergeCompilableQuery(
      system.db.query.asset_content_link.findMany({
        where: eq(asset_content_link.asset_id, asset_id)
      })
    ),
    enabled: !!asset_id
  });
}

export function getAssetContent(asset_id: string) {
  return hybridFetch<AssetContent>({
    offlineQuery: toMergeCompilableQuery(
      system.db.query.asset_content_link.findMany({
        where: eq(asset_content_link.asset_id, asset_id)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset_content_link')
        .select('*')
        .eq('asset_id', asset_id)
        .overrideTypes<AssetContent[]>();
      if (error) throw error;
      return data;
    }
  });
}

export function useAssetContent(asset_id: string) {
  const {
    data: assetContent,
    isLoading: isAssetContentLoading,
    ...rest
  } = useHybridQuery(getAssetContentConfig(asset_id));

  return { assetContent, isAssetContentLoading, ...rest };
}

function getAssetsContentConfig(asset_ids: string[]) {
  return createHybridQueryConfig({
    queryKey: ['asset-content', asset_ids],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset_content_link')
        .select('*')
        .in('asset_id', asset_ids)
        .overrideTypes<AssetContent[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toMergeCompilableQuery(
      system.db.query.asset_content_link.findMany({
        where: inArray(asset_content_link.asset_id, asset_ids)
      })
    ),
    enabled: !!asset_ids.length
  });
}

export function getAssetsContent(asset_ids: string[]) {
  return hybridFetch<AssetContent>({
    offlineQuery: toMergeCompilableQuery(
      system.db.query.asset_content_link.findMany({
        where: inArray(asset_content_link.asset_id, asset_ids)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset_content_link')
        .select('*')
        .in('asset_id', asset_ids)
        .overrideTypes<AssetContent[]>();
      if (error) throw error;
      return data;
    }
  });
}

export function useAssetsContent(asset_ids: string[]) {
  const {
    data: assetsContent,
    isLoading: isAssetContentLoading,
    ...rest
  } = useHybridQuery(getAssetsContentConfig(asset_ids));

  return { assetsContent, isAssetContentLoading, ...rest };
}

function getAssetAudioContentConfig(asset_id: string) {
  return createHybridQueryConfig({
    queryKey: ['asset-audio-content', asset_id],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset_content_link')
        .select('*')
        .eq('asset_id', asset_id)
        .not('audio_id', 'is', null)
        .overrideTypes<AssetContent[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toMergeCompilableQuery(
      system.db.query.asset_content_link.findMany({
        where: and(
          eq(asset_content_link.asset_id, asset_id),
          isNotNull(asset_content_link.audio_id)
        )
      })
    ),
    enabled: !!asset_id
  });
}

export function getAssetAudioContent(asset_id: string) {
  return hybridFetch<AssetContent>({
    offlineQuery: toMergeCompilableQuery(
      system.db.query.asset_content_link.findMany({
        where: and(
          eq(asset_content_link.asset_id, asset_id),
          isNotNull(asset_content_link.audio_id)
        )
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset_content_link')
        .select('*')
        .eq('asset_id', asset_id)
        .not('audio_id', 'is', null)
        .overrideTypes<AssetContent[]>();
      if (error) throw error;
      return data;
    }
  });
}

export function useAssetAudioContent(asset_id: string) {
  const {
    data: assetAudioContent,
    isLoading: isAssetAudioContentLoading,
    ...rest
  } = useHybridQuery(getAssetAudioContentConfig(asset_id));

  return { assetAudioContent, isAssetAudioContentLoading, ...rest };
}

function getAssetsAudioContentConfig(asset_ids: string[]) {
  return createHybridQueryConfig({
    queryKey: ['assets-audio-content', asset_ids],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset_content_link')
        .select('*')
        .in('asset_id', asset_ids)
        .not('audio_id', 'is', null)
        .overrideTypes<AssetContent[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toMergeCompilableQuery(
      system.db.query.asset_content_link.findMany({
        where: and(
          inArray(asset_content_link.asset_id, asset_ids),
          isNotNull(asset_content_link.audio_id)
        )
      })
    ),
    enabled: !!asset_ids.length
  });
}

export function getAssetsAudioContent(asset_ids: string[]) {
  return hybridFetch<AssetContent>({
    offlineQuery: toMergeCompilableQuery(
      system.db.query.asset_content_link.findMany({
        where: and(
          inArray(asset_content_link.asset_id, asset_ids),
          isNotNull(asset_content_link.audio_id)
        )
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset_content_link')
        .select('*')
        .in('asset_id', asset_ids)
        .not('audio_id', 'is', null)
        .overrideTypes<AssetContent[]>();
      if (error) throw error;
      return data;
    }
  });
}

export function useAssetsAudioContent(asset_ids: string[]) {
  const {
    data: assetsAudioContent,
    isLoading: isAssetsAudioContentLoading,
    ...rest
  } = useHybridQuery(getAssetsAudioContentConfig(asset_ids));

  return { assetsAudioContent, isAssetsAudioContentLoading, ...rest };
}

function getAssetsByQuestIdConfig(quest_id: string) {
  return createHybridQueryConfig({
    queryKey: ['assets', 'by-quest', quest_id],
    onlineFn: async () => {
      // Get assets through junction table
      const { data, error } = await system.supabaseConnector.client
        .from('quest_asset_link')
        .select(
          `
          asset:asset_id (
            *
          )
        `
        )
        .eq('quest_id', quest_id)
        .overrideTypes<{ asset: Asset }[]>();

      if (error) throw error;
      return data.map((item) => item.asset).filter(Boolean);
    },
    offlineQuery: toMergeCompilableQuery(
      system.db
        .select({
          id: asset.id,
          name: asset.name,
          // source_language_id removed from asset-level usage; use content-level source_language_id
          images: asset.images,
          creator_id: asset.creator_id,
          visible: asset.visible,
          active: asset.active,
          created_at: asset.created_at,
          last_updated: asset.last_updated
        })
        .from(asset)
        .innerJoin(quest_asset_link, eq(asset.id, quest_asset_link.asset_id))
        .where(eq(quest_asset_link.quest_id, quest_id))
    ),
    enabled: !!quest_id
  });
}

export function getAssetsByQuestId(quest_id: string) {
  return hybridFetch<Asset>({
    offlineQuery: toMergeCompilableQuery(
      system.db.query.asset.findMany({
        where: inArray(
          asset.id,
          system.db
            .select({ asset_id: quest_asset_link.asset_id })
            .from(quest_asset_link)
            .where(eq(quest_asset_link.quest_id, quest_id))
        )
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest_asset_link')
        .select(
          `
          asset:asset_id (
            *
          )
        `
        )
        .eq('quest_id', quest_id)
        .overrideTypes<{ asset: Asset }[]>();

      if (error) throw error;
      return data.map((item) => item.asset).filter(Boolean);
    }
  });
}

/**
 * Returns { assets, isLoading, error }
 * Fetches assets by quest ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useAssetsByQuestId(quest_id: string) {
  const {
    data: assets,
    isLoading: isAssetsLoading,
    ...rest
  } = useHybridQuery(getAssetsByQuestIdConfig(quest_id));

  return { assets, isAssetsLoading, ...rest };
}

/**
 * Returns { assets, isLoading, error }
 * Fetches assets by project ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useAssetsByProjectId(project_id: string) {
  const { db, supabaseConnector } = system;

  const {
    data: assets,
    isLoading: isAssetsLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['assets', 'by-project', project_id],
    onlineFn: async () => {
      // Get assets through quest -> quest_asset_link -> asset
      const { data, error } = await supabaseConnector.client
        .from('quest')
        .select(
          `
          quest_asset_link!inner (
            asset:asset_id (
              *
            )
          )
        `
        )
        .eq('project_id', project_id)
        .overrideTypes<{ quest_asset_link: { asset: Asset }[] }[]>();

      if (error) throw error;

      // Flatten and deduplicate assets
      const uniqueAssets = new Map<string, Asset>();
      data.forEach((questData) => {
        questData.quest_asset_link.forEach((link) => {
          uniqueAssets.set(link.asset.id, link.asset);
        });
      });

      return Array.from(uniqueAssets.values());
    },
    offlineQuery: toMergeCompilableQuery(
      db
        .selectDistinct({
          id: asset.id,
          name: asset.name,
          // source_language_id removed from asset-level usage; use content-level source_language_id
          images: asset.images,
          creator_id: asset.creator_id,
          visible: asset.visible,
          active: asset.active,
          created_at: asset.created_at,
          last_updated: asset.last_updated
        })
        .from(asset)
        .innerJoin(quest_asset_link, eq(asset.id, quest_asset_link.asset_id))
        .innerJoin(quest, eq(quest_asset_link.quest_id, quest.id))
        .where(eq(quest.project_id, project_id))
    ),
    enabled: !!project_id
  });

  return { assets, isAssetsLoading, ...rest };
}

/**
 * Returns { assets, isLoading, error }
 * Fetches assets with tags by quest ID from Supabase (online) or local Drizzle DB (offline)
 */

export function useAssetsWithTagsByQuestId(quest_id: string) {
  const { db, supabaseConnector } = system;

  const {
    data: assets,
    isLoading: isAssetsLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['assets', 'by-quest', 'with-tags', quest_id],
    onlineFn: async () => {
      // Get assets through junction table with tags
      const { data, error } = await supabaseConnector.client
        .from('quest_asset_link')
        .select(
          `
          asset:asset_id (
            *,
            tags:asset_tag_link (
              tag:tag_id (
                *
              )
            )
          )
        `
        )
        .eq('quest_id', quest_id)
        .overrideTypes<{ asset: Asset & { tags: { tag: Tag }[] } }[]>();

      if (error) throw error;
      return data;
    },
    offlineQuery: toMergeCompilableQuery(
      db.query.quest_asset_link.findMany({
        where: eq(quest_asset_link.quest_id, quest_id),
        columns: {},
        with: {
          asset: {
            with: {
              tags: {
                with: {
                  tag: true
                }
              }
            }
          }
        }
      })
    ),
    enabled: !!quest_id
  });

  return { assets, isAssetsLoading, ...rest };
}

export function useAssetsWithTagsAndContentByQuestId(quest_id: string) {
  const { db, supabaseConnector } = system;

  const {
    data: assets,
    isLoading: isAssetsLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['assets', 'by-quest', 'with-tags-content', quest_id],
    onlineFn: async () => {
      // Get assets through junction table with tags and content
      const { data, error } = await supabaseConnector.client
        .from('quest_asset_link')
        .select(
          `
          asset:asset_id (
            *,
            content:asset_content_link (
              *
            ),
            tags:asset_tag_link (
              tag:tag_id (
                *
              )
            )
          )
        `
        )
        .eq('quest_id', quest_id)
        .overrideTypes<
          { asset: Asset & { tags: { tag: Tag }[]; content: AssetContent[] } }[]
        >();

      if (error) throw error;
      return data.map((item) => item.asset).filter(Boolean);
    },
    offlineQuery: toMergeCompilableQuery(
      db.query.asset.findMany({
        where: inArray(
          asset.id,
          db
            .select({ asset_id: quest_asset_link.asset_id })
            .from(quest_asset_link)
            .where(eq(quest_asset_link.quest_id, quest_id))
        ),
        with: {
          content: true,
          tags: {
            with: {
              tag: true
            }
          }
        }
      })
    ),
    enabled: !!quest_id
  });

  return { assets, isAssetsLoading, ...rest };
}

/**
 * Returns { assets, isLoading, error }
 * Fetches assets with translations and votes by quest ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useAssetsWithTranslationsAndVotesByQuestId(quest_id: string) {
  const { db, supabaseConnector } = system;

  const {
    data: assets,
    isLoading: isAssetsLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['assets', 'by-quest', 'with-translations-votes', quest_id],
    onlineFn: async () => {
      // Get assets through junction table with translations and votes
      const { data, error } = await supabaseConnector.client
        .from('quest_asset_link')
        .select(
          `
          asset:asset_id (
            *,
            translations:translation (
              *,
              votes:vote (
                *
              )
            )
          )
        `
        )
        .eq('quest_id', quest_id)
        .overrideTypes<
          {
            asset: Asset & {
              translations: (Translation & { votes: Vote[] })[];
            };
          }[]
        >();

      if (error) throw error;
      return data.map((item) => item.asset).filter(Boolean);
    },
    offlineQuery: toMergeCompilableQuery(
      db.query.asset.findMany({
        where: inArray(
          asset.id,
          db
            .select({ asset_id: quest_asset_link.asset_id })
            .from(quest_asset_link)
            .where(eq(quest_asset_link.quest_id, quest_id))
        ),
        with: {
          translations: {
            with: {
              votes: true
            }
          }
        }
      })
    ),
    enabled: !!quest_id
  });

  return { assets, isAssetsLoading, ...rest };
}

/**
 * Returns { assets, isLoading, error }
 * Fetches assets with translations and votes by project ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useAssetsWithTranslationsAndVotesByProjectId(
  project_id: string
) {
  const { db, supabaseConnector } = system;

  const {
    data: assets,
    isLoading: isAssetsLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['assets', 'by-project', 'with-translations-votes', project_id],
    onlineFn: async () => {
      // Get assets through quest -> quest_asset_link -> asset with translations and votes
      const { data, error } = await supabaseConnector.client
        .from('quest')
        .select(
          `
          quest_asset_link!inner (
            asset:asset_id (
              *,
              translations:translation (
                *,
                votes:vote (
                  *
                )
              )
            )
          )
        `
        )
        .eq('project_id', project_id)
        .overrideTypes<
          {
            quest_asset_link: {
              asset: Asset & {
                translations: (Translation & { votes: Vote[] })[];
              };
            }[];
          }[]
        >();

      if (error) throw error;

      // Flatten and deduplicate assets
      const uniqueAssets = new Map<
        string,
        Asset & { translations: (Translation & { votes: Vote[] })[] }
      >();
      data.forEach((questData) => {
        questData.quest_asset_link.forEach((link) => {
          uniqueAssets.set(link.asset.id, link.asset);
        });
      });

      return Array.from(uniqueAssets.values());
    },
    offlineQuery: toMergeCompilableQuery(
      db.query.asset.findMany({
        where: inArray(
          asset.id,
          db
            .selectDistinct({ asset_id: quest_asset_link.asset_id })
            .from(quest_asset_link)
            .innerJoin(quest, eq(quest_asset_link.quest_id, quest.id))
            .where(eq(quest.project_id, project_id))
        ),
        with: {
          translations: {
            with: {
              votes: true
            }
          }
        }
      })
    ),
    enabled: !!project_id
  });

  return { assets, isAssetsLoading, ...rest };
}

/**
 * Hybrid infinite query for assets with tags and content
 * Automatically switches between online and offline with proper caching
 * Follows TKDodo's best practices for infinite queries
 */
export function useInfiniteAssetsWithTagsByQuestId(
  quest_id: string,
  pageSize = 10,
  sortField?: string,
  sortOrder?: 'asc' | 'desc',
  searchQuery?: string,
  activeFilters?: Record<string, string[]>
) {
  const queryKey = useMemo(() => {
    // Filter out undefined values from query key to prevent null values
    const queryKeyParts = [
      'assets',
      'infinite',
      'by-quest',
      'with-tags-content',
      quest_id,
      pageSize
    ];
    if (sortField) queryKeyParts.push(sortField);
    if (sortOrder) queryKeyParts.push(sortOrder);
    if (searchQuery) queryKeyParts.push(searchQuery);
    if (activeFilters) queryKeyParts.push(JSON.stringify(activeFilters));

    return queryKeyParts;
  }, [quest_id, pageSize, sortField, sortOrder, searchQuery]);

  return useHybridInfiniteQuery({
    queryKey: queryKey,
    onlineFn: async ({ pageParam, signal }) => {
      // Calculate pagination range
      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      // Build tag name filters first to determine query structure
      const tagNameFilters: string[] = [];

      if (activeFilters) {
        Object.entries(activeFilters).forEach(([category, selectedValues]) => {
          if (selectedValues.length > 0) {
            selectedValues.forEach((fullValue) => {
              // Extract just the value part after the colon (e.g., "Lucas" from "libro:lucas")
              const valuePart = fullValue.split(':')[1] || fullValue;
              const tagName = `${category}:${valuePart}`;
              tagNameFilters.push(tagName);
            });
          }
        });
      }

      // Build query based on whether we have tag filtering
      let query;
      if (tagNameFilters.length > 0) {
        // Use inner join syntax when filtering by tags
        query = system.supabaseConnector.client
          .from('quest_asset_link')
          .select(
            `
            visible, active,
            asset:asset_id (
              *,
              tags:asset_tag_link!inner (
                tag:tag_id!inner (
                  *
                )
              )
            )
          `
          )
          .eq('quest_id', quest_id)
          .in('asset_id.tags.tag.name', tagNameFilters);
      } else {
        // Use regular left join when no tag filtering
        query = system.supabaseConnector.client
          .from('quest_asset_link')
          .select(
            `
            visible, active,
            asset:asset_id (
              *,
              tags:asset_tag_link (
                tag:tag_id (
                  *
                )
              )
            )
          `
          )
          .eq('quest_id', quest_id);
      }

      /* Verify if invisible assets should be excluded */
      const includeInvisible = await getOptionShowHiddenContent();
      if (!includeInvisible) {
        query = query.eq('visible', true).filter('asset.visible', 'eq', true);
        /* .eq('active', true); // if needed to include active */
      }

      // Add search functionality
      if (searchQuery) {
        const searchTerm = searchQuery.trim();

        console.log('searchTerm', searchTerm);
        // Search in asset names using Supabase's nested field filtering
        query = query.filter('asset.name', 'ilike', `%${searchTerm}%`);
      }

      // Add sorting if specified
      if (sortField && sortOrder) {
        // Note: Supabase doesn't support ordering by nested fields in this format
        // So we'll apply sorting on the client side after fetching
        // Default ordering to ensure consistent pagination
        query = query.order('created_at', { ascending: true });
      } else {
        // Default sort - also use created_at for consistency
        query = query.order('created_at', { ascending: true });
      }

      // Add pagination
      query = query.range(from, to);

      // Add abort signal for proper cleanup
      const { data, error, count } = await query
        .abortSignal(signal)
        .overrideTypes<{ asset: Asset & { tags: { tag: Tag }[] } }[]>();

      if (error) throw error;

      let assets = data
        .map((item) => {
          item.asset.visible = (item.visible && item.asset.visible) as boolean;
          item.asset.active = (item.active && item.asset.active) as boolean;
          return item.asset;
        })
        .filter(Boolean);

      // Apply client-side sorting if needed
      if (sortField && sortOrder) {
        assets = assets.sort((a, b) => {
          const aValue = a[sortField as keyof Asset];
          const bValue = b[sortField as keyof Asset];

          if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortOrder === 'asc'
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue);
          }

          return 0;
        });
      }

      const totalCount = count ?? 0;
      const hasMore = from + pageSize < totalCount;

      return {
        data: assets,
        nextCursor: hasMore ? pageParam + 1 : undefined,
        hasMore,
        totalCount
      };
    },
    offlineFn: async ({ pageParam }) => {
      // Offline query with manual pagination using Drizzle
      const offsetValue = pageParam * pageSize;

      try {
        console.log(
          `[OfflineAssets] Loading page ${pageParam} for quest ${quest_id}, offset: ${offsetValue}`
        );

        // Build the base subquery for assets in this quest
        let assetIdsSubquery = system.db
          .select({
            asset_id: quest_asset_link.asset_id,
            visible: quest_asset_link.visible,
            active: quest_asset_link.active
          })
          .from(quest_asset_link)
          .where(eq(quest_asset_link.quest_id, quest_id));

        // Add search functionality for offline queries
        if (searchQuery) {
          const searchTerm = `%${searchQuery.trim()}%`;

          // Get asset IDs that match search criteria within this quest (asset names only)
          const searchMatchingAssets = system.db
            .select({ id: asset.id })
            .from(asset)
            .where(like(asset.name, searchTerm));

          // Filter the quest assets to only include those that match search
          assetIdsSubquery = system.db
            .select({
              asset_id: quest_asset_link.asset_id,
              visible: quest_asset_link.visible,
              active: quest_asset_link.active
            })
            .from(quest_asset_link)
            .where(
              and(
                eq(quest_asset_link.quest_id, quest_id),
                inArray(quest_asset_link.asset_id, searchMatchingAssets)
              )
            );
        }

        // Build tag filtering conditions for offline query using Drizzle SQL operators
        const tagFilterConditions: SQL<unknown>[] = [];

        if (activeFilters) {
          Object.entries(activeFilters).forEach(
            ([category, selectedValues]) => {
              if (selectedValues.length > 0) {
                // Create OR conditions for each value in this category
                const categoryConditions = selectedValues.map((fullValue) => {
                  const valuePart = fullValue.split(':')[1] || fullValue;
                  // Use SQL template for case-insensitive matching
                  return sql`${tag.name} LIKE ${`${category}:${valuePart}`}`;
                });

                if (categoryConditions.length > 0) {
                  // Combine multiple values in the same category with OR
                  const condition =
                    categoryConditions.length === 1
                      ? categoryConditions[0]!
                      : or(...categoryConditions);

                  if (condition) {
                    tagFilterConditions.push(condition);
                  }
                }
              }
            }
          );
        }

        // Apply tag filtering to the asset subquery if needed
        if (tagFilterConditions.length > 0) {
          // Combine tag filter conditions
          const combinedTagConditions =
            tagFilterConditions.length === 1
              ? tagFilterConditions[0]
              : and(...tagFilterConditions);

          // Only proceed if we have valid conditions
          if (combinedTagConditions) {
            // Create EXISTS subquery for tag filtering on assets
            const tagFilterSubquery = system.db
              .select({ assetId: asset_tag_link.asset_id })
              .from(asset_tag_link)
              .innerJoin(tag, eq(tag.id, asset_tag_link.tag_id))
              .where(
                and(
                  eq(asset_tag_link.active, true),
                  eq(tag.active, true),
                  combinedTagConditions
                )
              );

            // Filter the base subquery to only include assets that match tag criteria
            assetIdsSubquery = system.db
              .select({
                asset_id: quest_asset_link.asset_id,
                visible: quest_asset_link.visible,
                active: quest_asset_link.active
              })
              .from(quest_asset_link)
              .where(
                and(
                  eq(quest_asset_link.quest_id, quest_id),
                  inArray(quest_asset_link.asset_id, tagFilterSubquery)
                )
              );
          }
        }

        const allAssets = await system.db.query.asset.findMany({
          where: inArray(asset.id, assetIdsSubquery),
          with: {
            tags: {
              with: {
                tag: true
              }
            }
          },
          limit: pageSize,
          offset: offsetValue,
          orderBy:
            sortField === 'name' && sortOrder
              ? sortOrder === 'asc'
                ? asc(asset.name)
                : desc(asset.name)
              : asc(asset.name)
        });

        // Get total count for hasMore calculation
        const totalAssets = await system.db
          .select({ asset_id: quest_asset_link.asset_id })
          .from(quest_asset_link)
          .where(eq(quest_asset_link.quest_id, quest_id));

        /* 
          NEED TO CHECK: if total should count inactive assets
        */
        const totalCount = totalAssets.length;
        const hasMore = offsetValue + pageSize < totalCount;

        console.log(
          `[OfflineAssets] Found ${allAssets.length} assets, total: ${totalCount}, hasMore: ${hasMore}`
        );

        return {
          data: allAssets,
          nextCursor: hasMore ? pageParam + 1 : undefined,
          hasMore,
          totalCount
        };
      } catch (error) {
        console.error('[OfflineAssets] Error in offline query:', error);
        // Return empty result rather than throwing
        return {
          data: [],
          nextCursor: undefined,
          hasMore: false,
          totalCount: 0
        };
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!quest_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  });
}

function getAssetQuestLinkById(
  quest_id: string | undefined,
  asset_id: string | undefined
) {
  return createHybridQueryConfig({
    queryKey: ['quest-asset-link', quest_id, asset_id],
    onlineFn: async () => {
      // Get assets through junction table
      if (!quest_id || !asset_id) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('quest_asset_link')
        .select(
          `
          visible, active
        `
        )
        .eq('quest_id', quest_id)
        .eq('asset_id', asset_id);
      // .overrideTypes<{ questAssetLink: QuestAssetLink }[]>();

      if (error) throw error;
      return data; // .map((item) => item.asset).filter(Boolean);
    },
    offlineQuery: toMergeCompilableQuery(
      system.db
        .select({
          visible: quest_asset_link.visible,
          active: quest_asset_link.active
        })
        .from(quest_asset_link)
        .where(
          and(
            eq(quest_asset_link.quest_id, quest_id || ''),
            eq(quest_asset_link.asset_id, asset_id || '')
          )
        )
    ),
    enabled: !!quest_id && !!asset_id
  });
}

// export function getAssetsByQuestId(quest_id: string) {
//   return hybridFetch(convertToFetchConfig(getAssetsByQuestIdConfig(quest_id)));
// }

/**
 * Returns { assets, isLoading, error }
 * Fetches assets by quest ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useAssetsQuestLinkById(
  quest_id: string | undefined,
  asset_id: string | undefined
) {
  const {
    data: quest_asset_link,
    isLoading: isDataLoading,
    ...rest
  } = useHybridQuery(getAssetQuestLinkById(quest_id, asset_id));

  return { quest_asset_link, isDataLoading, ...rest };
}

type AssetQuestLink = Asset & {
  quest_active: boolean;
  quest_visible: boolean;
};

export function useAssetsByQuest(
  quest_id: string,
  searchQuery: string,
  showHiddenContent: boolean
) {
  const { data: restrictions, isRestrictionsLoading } = useUserRestrictions(
    'assets',
    true,
    true,
    false
  );

  const blockContentIds = (restrictions.blockedContentIds ?? []).map(
    (c) => c.content_id
  );
  const blockUserIds = (restrictions.blockedUserIds ?? []).map(
    (c) => c.blocked_id
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isAssetsLoading,
    isOnline,
    isFetching
  } = useSimpleHybridInfiniteData<AssetQuestLink>(
    'assets',
    [quest_id || '', searchQuery],
    // Offline query function - Assets must be downloaded to use
    async ({ pageParam, pageSize }) => {
      if (!quest_id) return [];

      try {
        const offset = pageParam * pageSize;

        const conditions = [
          eq(quest_asset_link.quest_id, quest_id),
          !showHiddenContent && eq(asset.visible, true),
          !showHiddenContent && eq(quest_asset_link.visible, true),
          blockContentIds.length > 0 && notInArray(asset.id, blockContentIds),
          blockUserIds.length > 0 &&
            or(
              isNull(asset.creator_id),
              notInArray(asset.creator_id, blockUserIds)
            ),
          searchQuery.trim() && and(like(asset.name, `%${searchQuery.trim()}%`))
        ];

        // Normal pagination without search
        const assets = await mergeQuery(
          system.db
            .select({
              ...getTableColumns(asset),
              quest_visible: quest_asset_link.visible,
              quest_active: quest_asset_link.active
            })
            .from(asset)
            .innerJoin(
              quest_asset_link,
              eq(asset.id, quest_asset_link.asset_id)
            )
            .where(and(...conditions.filter(Boolean)))
            .limit(pageSize)
            .offset(offset)
        );

        return assets;
      } catch (error) {
        console.error('[ASSETS] Offline query error:', error);
        return [];
      }
    },
    // Cloud query function - Since assets must be downloaded, we return empty
    // eslint-disable-next-line @typescript-eslint/require-await
    async () => {
      // Assets must be downloaded to be used, so cloud query returns empty
      return [] as WithSource<AssetQuestLink>[];
    },
    20 // pageSize
  );

  return {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isAssetsLoading || isRestrictionsLoading,
    isOnline,
    isFetching
  };
}
