import { asset, quest_asset_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { localSourceOverrideOptions, resolveTable } from '@/utils/dbUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';
import type { LayerStatus } from '../types';

interface AssetStatus {
  full: LayerStatus;
  currentQuest?: LayerStatus;
}

export type refetchType = 'asset' | 'asset_quest' | 'both';

export interface AssetStatusHook {
  data: AssetStatus | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: (type: refetchType) => void;
}

export function useAssetStatuses(
  assetId: string,
  questId: string
): AssetStatusHook {
  let full: LayerStatus = { active: true, visible: true, source: 'local' };
  let currentQuest: LayerStatus | undefined = undefined;

  const {
    data: assetData = [],
    refetch: assetRefetch,
    isLoading: isAssetLoading,
    isError: isAssetError,
    offlineError: assetOfflineError,
    cloudError: assetCloudError
  } = useHybridData({
    dataType: 'asset-settings',
    queryKeyParams: [assetId],
    offlineQuery: toCompilableQuery(
      system.db.query.asset.findFirst({
        columns: {
          active: true,
          visible: true,
          source: true
        },
        where: eq(asset.id, assetId)
      })
    ),
    cloudQueryFn: async (): Promise<(typeof asset.$inferSelect)[]> => {
      const { data, error } = await system.supabaseConnector.client
        .from('asset')
        .select('active, visible')
        .eq('id', assetId)
        .limit(1);

      if (error) throw error;
      return data as (typeof asset.$inferSelect)[];
    }
  });

  // Always call all hooks before any early returns to maintain hook order
  const {
    data: assetQuestDataArray = [],
    refetch: assetQuestRefetch,
    isLoading: isAssetQuestLoading,
    isError: isAssetQuestError,
    offlineError: assetQuestOfflineError,
    cloudError: assetQuestCloudError
  } = useHybridData({
    dataType: 'quest-asset-settings',
    queryKeyParams: [questId, assetId],
    offlineQuery: toCompilableQuery(
      system.db.query.quest_asset_link.findMany({
        columns: {
          active: true,
          visible: true
        },
        where: and(
          eq(quest_asset_link.quest_id, questId),
          eq(quest_asset_link.asset_id, assetId)
        )
      })
    ),
    cloudQueryFn: async (): Promise<
      (typeof quest_asset_link.$inferSelect)[]
    > => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest_asset_link')
        .select('active, visible')
        .match({ quest_id: questId, asset_id: assetId })
        .limit(1);
      if (error) throw error;
      return data as (typeof quest_asset_link.$inferSelect)[];
    },
    enableCloudQuery: assetData[0] && assetData[0].source !== 'local' // Only fetch cloud data if the asset is not local
  });

  // Handle error case after all hooks have been called
  if (isAssetError) {
    console.error('Error fetching asset status:', {
      offlineError: assetOfflineError,
      cloudError: assetCloudError,
      assetId
    });
    return {
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: () => null
    };
  }

  // Log quest-asset link errors if they occur
  if (isAssetQuestError) {
    console.error('Error fetching quest-asset link status:', {
      offlineError: assetQuestOfflineError,
      cloudError: assetQuestCloudError,
      questId,
      assetId
    });
  }

  full = assetData[0] ?? { active: true, visible: true, source: 'local' };

  currentQuest = assetQuestDataArray[0] ?? {
    active: true,
    visible: true,
    source: 'synced'
  };

  function refetch(type: refetchType) {
    if (type != 'asset_quest') assetRefetch();
    if (type != 'asset') assetQuestRefetch();
  }

  return {
    data: { full, currentQuest },
    isLoading: isAssetLoading || isAssetQuestLoading,
    isError: isAssetQuestError,
    refetch
  };
}

type AssetStatusUpdate = 'asset' | 'asset_quest';

export async function updateAssetStatus(
  type: AssetStatusUpdate,
  assetId: string,
  status: Partial<Pick<LayerStatus, 'active' | 'visible'>>,
  assetSource: HybridDataSource,
  questId?: string
) {
  const { db } = system;

  if (type == 'asset_quest' && questId !== undefined) {
    const resolvedQuestAssetLink = resolveTable(
      'quest_asset_link',
      localSourceOverrideOptions(assetSource)
    );
    return await db
      .update(resolvedQuestAssetLink)
      .set({ ...status, last_updated: new Date().toISOString() })
      .where(
        and(
          eq(resolvedQuestAssetLink.quest_id, questId),
          eq(resolvedQuestAssetLink.asset_id, assetId)
        )
      );
  }
  if (type == 'asset') {
    const resolvedAsset = resolveTable(
      'asset',
      localSourceOverrideOptions(assetSource)
    );
    return await db
      .update(resolvedAsset)
      .set({ ...status })
      .where(eq(resolvedAsset.id, assetId));
  }
}
