import { asset, quest_asset_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver/lib/src/utils/compilableQuery';
// import { useQueryClient } from '@tanstack/react-query/build/legacy/QueryClientProvider';
import { useHybridQuery } from '@/hooks/useHybridQuery';
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

  const { db, supabaseConnector } = system;
  const {
    data: assetData = [],
    refetch: assetRefetch,
    isLoading: isAssetLoading,
    isError: isAssetError
  } = useHybridQuery({
    queryKey: ['asset-settings', assetId],
    offlineQuery: toCompilableQuery(
      db.query.asset.findMany({
        columns: {
          active: true,
          visible: true
        },
        where: eq(asset.id, assetId)
      })
    ),
    onlineFn: async (): Promise<(typeof asset.$inferSelect)[]> => {
      const { data, error } = await supabaseConnector.client
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
    isLoading,
    isError,
    refetch: refetchAQ
  } = useHybridQuery({
    queryKey: ['quest-asset-settings', questId, assetId],
    offlineQuery: toCompilableQuery(
      db.query.quest_asset_link.findMany({
        columns: {
          active: true,
          visible: true
        },
        where:
          (eq(quest_asset_link.quest_id, questId),
          eq(quest_asset_link.asset_id, assetId))
      })
    ),
    onlineFn: async (): Promise<(typeof quest_asset_link.$inferSelect)[]> => {
      const { data, error } = await supabaseConnector.client
        .from('quest_asset_link')
        .select('active, visible')
        .match({ quest_id: questId, asset_id: assetId })
        .limit(1);
      if (error) throw error;
      return data as (typeof quest_asset_link.$inferSelect)[];
    }
  });
  currentQuest = assetQuestDataArray[0] ?? { active: true, visible: true };
  const refetchAssetQuest = refetchAQ;
  const isAssetQuestLoading = isLoading;
  const isAssetQuestError = isError;

  function refetch(type: refetchType) {
    if (type != 'asset_quest') assetRefetch();
    if (type != 'asset') refetchAssetQuest();
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
