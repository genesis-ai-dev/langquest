import { useAuth } from '@/contexts/AuthContext';
import {
  asset,
  asset_tag_link,
  blocked_content,
  blocked_users,
  quest_asset_link
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { blockedContentQuery, blockedUsersQuery } from '@/utils/dbUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useSimpleHybridInfiniteData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@tanstack/react-query';
import type { InferSelectModel } from 'drizzle-orm';
import {
  and,
  asc,
  eq,
  getTableColumns,
  getTableName,
  isNull,
  like,
  notInArray,
  or,
  sql
} from 'drizzle-orm';
import React from 'react';
import { useHybridQuery } from '../useHybridQuery';

export type Asset = InferSelectModel<typeof asset>;

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
    offlineQuery: toCompilableQuery(
      db.query.asset.findMany({
        where: (fields, { eq }) => eq(fields.id, asset_id!),
        limit: 1
      })
    )
  });

  const asset = assetArray[0] || null;

  return { asset, isAssetLoading, ...rest };
}

type AssetQuestLink = Asset & {
  quest_active: boolean;
  quest_visible: boolean;
  tag_ids?: string[];
  source?: HybridDataSource;
};

type QuestAssetLinkAssetRow = Asset & {
  link_name?: string | null;
  link_order_index?: number | null;
  link_metadata?: string | null;
  quest_active: boolean;
  quest_visible: boolean;
  tag_ids?: string | string[];
};

function parseQuestAssetMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'string') {
    return metadata ?? null;
  }

  try {
    return JSON.parse(metadata) as Asset['metadata'];
  } catch {
    return metadata;
  }
}

/**
 * quest_asset_link.order_index is NOT NULL DEFAULT 0, so a legacy link that
 * never received a placement is indistinguishable from position 0. Mirror
 * backfill_quest_asset_link_placement and use the asset order in that case.
 */
function resolveQuestAssetOrderIndex(
  linkOrderIndex: number | null | undefined,
  assetOrderIndex: number | null | undefined
): number {
  if (typeof linkOrderIndex === 'number' && linkOrderIndex !== 0) {
    return linkOrderIndex;
  }
  if (typeof assetOrderIndex === 'number' && assetOrderIndex !== 0) {
    return assetOrderIndex;
  }
  return 0;
}

function normalizeQuestAssetLinkAssetRow(
  row: QuestAssetLinkAssetRow
): AssetQuestLink {
  let tagIds: string[] = [];

  if (Array.isArray(row.tag_ids)) {
    tagIds = row.tag_ids;
  } else if (row.tag_ids) {
    try {
      const parsed = JSON.parse(String(row.tag_ids));
      tagIds = Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch (error) {
      console.warn(
        '[useAssetsByQuest] Failed to parse tag_ids:',
        row.tag_ids,
        error
      );
    }
  }

  const {
    link_name: linkName,
    link_order_index: linkOrderIndex,
    link_metadata: linkMetadata,
    ...assetRow
  } = row;

  return {
    ...assetRow,
    name: linkName ?? assetRow.name,
    order_index: resolveQuestAssetOrderIndex(
      linkOrderIndex,
      assetRow.order_index
    ),
    metadata: parseQuestAssetMetadata(linkMetadata ?? assetRow.metadata),
    tag_ids: tagIds
  } as AssetQuestLink;
}

export function useAssetsByQuest(
  quest_id: string,
  searchQuery: string,
  showHiddenContent: boolean
) {
  const { currentUser } = useAuth();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isOnline,
    isFetching,
    refetch
  } = useSimpleHybridInfiniteData<AssetQuestLink>(
    'assets',
    ['by-quest', quest_id || '', searchQuery, showHiddenContent],
    async ({ pageParam, pageSize }) => {
      if (!quest_id) return [];

      try {
        const offset = pageParam * pageSize;
        const searchTerm = searchQuery.trim();
        const displayName = sql<string>`coalesce(${quest_asset_link.name}, ${asset.name})`;

        const conditions = [
          eq(quest_asset_link.quest_id, quest_id),
          isNull(asset.source_asset_id),
          // The ternary has to wrap the whole or(): with it inside, drizzle
          // drops the undefined operand when showing hidden content and the
          // clause collapses to "creator_id = me", hiding other people's
          // assets entirely.
          !showHiddenContent
            ? or(eq(asset.visible, true), eq(asset.creator_id, currentUser!.id))
            : undefined,
          !showHiddenContent
            ? or(
                eq(quest_asset_link.visible, true),
                eq(asset.creator_id, currentUser!.id)
              )
            : undefined,
          notInArray(asset.id, blockedContentQuery(currentUser!.id, 'asset')),
          notInArray(asset.creator_id, blockedUsersQuery(currentUser!.id)),
          searchTerm && like(displayName, `%${searchTerm}%`)
        ];

        const assets = await system.db
          .select({
            ...getTableColumns(asset),
            link_name: quest_asset_link.name,
            link_order_index: quest_asset_link.order_index,
            link_metadata: quest_asset_link.metadata,
            quest_visible: quest_asset_link.visible,
            quest_active: quest_asset_link.active,
            tag_ids: sql<string>`(
              SELECT json_group_array(${asset_tag_link.tag_id})
              FROM ${asset_tag_link}
              WHERE ${asset_tag_link.asset_id} = ${asset.id}
            )`
          })
          .from(quest_asset_link)
          .innerJoin(asset, eq(asset.id, quest_asset_link.asset_id))
          .where(and(...conditions.filter(Boolean)))
          .orderBy(
            asc(quest_asset_link.order_index),
            asc(asset.created_at),
            asc(displayName)
          )
          .limit(pageSize)
          .offset(offset);

        return assets.map((row) =>
          normalizeQuestAssetLinkAssetRow(
            row as unknown as QuestAssetLinkAssetRow
          )
        );
      } catch (error) {
        console.error('[ASSETS] Offline query error:', error);
        return [];
      }
    },
    async ({ pageParam, pageSize }) => {
      if (!quest_id) return [];

      const offset = pageParam * pageSize;
      const from = offset;
      const to = offset + pageSize - 1;
      const searchTerm = searchQuery.trim();

      let query = system.supabaseConnector.client
        .from('quest_asset_link')
        .select(
          `
          name,
          order_index,
          metadata,
          visible,
          active,
          asset:asset_id (
            *,
            asset_tag_link(tag_id)
          )
        `
        )
        .eq('quest_id', quest_id)
        .is('asset.source_asset_id', null);

      if (!showHiddenContent) {
        query = query.eq('visible', true).filter('asset.visible', 'eq', true);
      } else if (currentUser?.id) {
        query = query.or(
          `visible.eq.true,asset.creator_id.eq.${currentUser.id}`
        );
      } else {
        query = query.eq('visible', true).filter('asset.visible', 'eq', true);
      }

      if (searchTerm) {
        query = query.or(
          `name.ilike.%${searchTerm}%,asset.name.ilike.%${searchTerm}%`
        );
      }

      query = query.order('order_index', { ascending: true });

      const { data, error } = await query.range(from, to).overrideTypes<
        {
          name: string | null;
          order_index: number | null;
          metadata: string | null;
          visible: boolean;
          active: boolean;
          asset: Asset & { asset_tag_link?: { tag_id: string }[] };
        }[]
      >();

      if (error) throw error;

      return data.map((item) =>
        normalizeQuestAssetLinkAssetRow({
          ...item.asset,
          link_name: item.name,
          link_order_index: item.order_index,
          link_metadata: item.metadata,
          quest_visible: item.visible,
          quest_active: item.active,
          tag_ids: item.asset.asset_tag_link?.map((link) => link.tag_id) || []
        } as QuestAssetLinkAssetRow)
      );
    },
    20, // pageSize
    [
      getTableName(quest_asset_link),
      getTableName(asset),
      getTableName(asset_tag_link),
      getTableName(blocked_content),
      getTableName(blocked_users)
    ]
  );

  return {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isOnline,
    isFetching,
    refetch
  };
}

export function useLocalAssetsByQuest(
  quest_id: string,
  searchQuery: string,
  showHiddenContent: boolean
) {
  const { currentUser } = useAuth();
  const isOnline = useNetworkStatus();

  const simpleQuery = useQuery({
    queryKey: [
      'assets',
      'by-quest-local-simple',
      quest_id || '',
      searchQuery,
      showHiddenContent
    ],
    queryFn: async () => {
      if (!quest_id || !currentUser) return [];

      try {
        const searchTerm = searchQuery.trim();
        const displayName = sql<string>`coalesce(${quest_asset_link.name}, ${asset.name})`;

        const conditions = [
          eq(quest_asset_link.quest_id, quest_id),
          isNull(asset.source_asset_id),
          // See useAssetsByQuest: the ternary must wrap the whole or().
          !showHiddenContent
            ? or(eq(asset.visible, true), eq(asset.creator_id, currentUser.id))
            : undefined,
          !showHiddenContent
            ? or(
                eq(quest_asset_link.visible, true),
                eq(asset.creator_id, currentUser.id)
              )
            : undefined,
          notInArray(asset.id, blockedContentQuery(currentUser.id, 'asset')),
          notInArray(asset.creator_id, blockedUsersQuery(currentUser.id)),
          searchTerm && like(displayName, `%${searchTerm}%`)
        ];

        const assets = await system.db
          .select({
            ...getTableColumns(asset),
            link_name: quest_asset_link.name,
            link_order_index: quest_asset_link.order_index,
            link_metadata: quest_asset_link.metadata,
            quest_visible: quest_asset_link.visible,
            quest_active: quest_asset_link.active,
            tag_ids: sql<string>`(
              SELECT json_group_array(${asset_tag_link.tag_id})
              FROM ${asset_tag_link}
              WHERE ${asset_tag_link.asset_id} = ${asset.id}
            )`
          })
          .from(quest_asset_link)
          .innerJoin(asset, eq(asset.id, quest_asset_link.asset_id))
          .where(and(...conditions.filter(Boolean)))
          .orderBy(
            asc(quest_asset_link.order_index),
            asc(asset.created_at),
            asc(displayName)
          );

        return assets.map((row) =>
          normalizeQuestAssetLinkAssetRow(
            row as unknown as QuestAssetLinkAssetRow
          )
        );
      } catch (error) {
        console.error('[useLocalAssetsByQuest] Query error:', error);
        return [];
      }
    },
    enabled: !!quest_id && !!currentUser
  });

  const wrappedData = React.useMemo(() => {
    if (!simpleQuery.data) {
      return { pages: [], pageParams: [] };
    }

    return {
      pages: [{ data: simpleQuery.data }],
      pageParams: [0]
    };
  }, [simpleQuery.data]);

  return {
    data: wrappedData,
    fetchNextPage: () =>
      Promise.resolve({
        data: wrappedData,
        pageParam: undefined
      }),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: simpleQuery.isLoading,
    isOnline,
    isFetching: simpleQuery.isFetching,
    refetch: simpleQuery.refetch
  };
}
