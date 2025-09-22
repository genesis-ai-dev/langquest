import { asset, quest_asset_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toMergeCompilableQuery } from '@/utils/dbUtils';
import { useHybridData } from '@/views/new/useHybridData';
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
  let full: LayerStatus = { active: true, visible: true };
  let currentQuest: LayerStatus | undefined = undefined;

  const {
    data: assetData = [],
    refetch: assetRefetch,
    isLoading: isAssetLoading,
    isError: isAssetError
  } = useHybridData({
    dataType: 'asset-settings',
    queryKeyParams: [assetId],
    offlineQuery: toMergeCompilableQuery(
      system.db.query.asset.findMany({
        columns: {
          active: true,
          visible: true
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

  if (isAssetError) {
    console.error('Error fetching asset status:', isAssetError);
    return {
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: () => null
    };
  }

  full = assetData[0] ?? { active: true, visible: true };

  const {
    data: assetQuestDataArray = [],
    refetch: assetQuestRefetch,
    isLoading: isAssetQuestLoading,
    isError: isAssetQuestError
  } = useHybridData({
    dataType: 'quest-asset-settings',
    queryKeyParams: [questId, assetId],
    offlineQuery: toMergeCompilableQuery(
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
    cloudQueryFn: async (): Promise<(typeof quest_asset_link.$inferSelect)[]> => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest_asset_link')
        .select('active, visible')
        .match({ quest_id: questId, asset_id: assetId })
        .limit(1);
      if (error) throw error;
      return data as (typeof quest_asset_link.$inferSelect)[];
    }
  });
  
  currentQuest = assetQuestDataArray[0] ?? { active: true, visible: true };

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
  questId?: string
) {
  const { db } = system;

  if (type == 'asset_quest' && questId !== undefined) {
    return await db
      .update(quest_asset_link)
      .set({ ...status, last_updated: new Date().toISOString() })
      .where(
        and(
          eq(quest_asset_link.quest_id, questId),
          eq(quest_asset_link.asset_id, assetId)
        )
      );
  }
  if (type == 'asset')
    return await db
      .update(asset)
      .set({ ...status, last_updated: new Date().toISOString() })
      .where(eq(asset.id, assetId));
}
