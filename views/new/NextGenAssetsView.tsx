import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { asset, quest_asset_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { Asset } from '@/hooks/db/useAssets';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AssetListItem } from './AssetListItem';

function useNextGenOfflineAssets(questId: string) {
  return useQuery({
    queryKey: ['assets', 'offline', questId],
    queryFn: async () => {
      // Get assets through quest_asset_link junction table
      const assets = await system.db
        .select({
          id: asset.id,
          name: asset.name,
          source_language_id: asset.source_language_id,
          images: asset.images,
          creator_id: asset.creator_id,
          visible: asset.visible,
          active: asset.active,
          created_at: asset.created_at,
          last_updated: asset.last_updated,
          download_profiles: asset.download_profiles
        })
        .from(asset)
        .innerJoin(quest_asset_link, eq(asset.id, quest_asset_link.asset_id))
        .where(eq(quest_asset_link.quest_id, questId));

      return assets.map((asset) => ({
        ...asset,
        source: 'localSqlite'
      }));
    },
    enabled: !!questId
  });
}

function useNextGenCloudAssets(questId: string, isOnline: boolean) {
  return useQuery({
    queryKey: ['assets', 'cloud', questId],
    queryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest_asset_link')
        .select(
          `
          asset:asset_id (
            *
          )
        `
        )
        .eq('quest_id', questId)
        .overrideTypes<{ asset: Asset }[]>();

      if (error) throw error;
      return data.map((item) => ({
        ...item.asset,
        source: 'cloudSupabase'
      }));
    },
    enabled: !!questId && isOnline // Only run when online and have questId
  });
}

export default function NextGenAssetsView() {
  const { currentQuestId } = useCurrentNavigation();
  const isOnline = useNetworkStatus();

  const { data: offlineAssets, isLoading: isOfflineLoading } =
    useNextGenOfflineAssets(currentQuestId || '');
  const {
    data: cloudAssets,
    isLoading: isCloudLoading,
    error: cloudError
  } = useNextGenCloudAssets(currentQuestId || '', isOnline);

  // Combine assets with offline taking precedence for duplicates
  const assets = React.useMemo(() => {
    const offlineAssetsArray = offlineAssets || [];
    const cloudAssetsArray = cloudAssets || [];

    // Create a map of offline assets by ID for quick lookup
    const offlineAssetMap = new Map(
      offlineAssetsArray.map((asset) => [asset.id, asset])
    );

    // Add cloud assets that don't exist in offline
    const uniqueCloudAssets = cloudAssetsArray.filter(
      (asset) => !offlineAssetMap.has(asset.id)
    );

    // Return offline assets first, then unique cloud assets
    return [...offlineAssetsArray, ...uniqueCloudAssets];
  }, [offlineAssets, cloudAssets]);

  // Watch attachment states for all assets
  const assetIds = React.useMemo(() => {
    return assets.map((asset) => asset.id);
  }, [assets]);

  const { attachmentStates, isLoading: isAttachmentStatesLoading } =
    useAttachmentStates(assetIds);

  // Get attachment state summary
  const attachmentStateSummary = React.useMemo(() => {
    if (attachmentStates.size === 0) {
      return {};
    }

    const states = Array.from(attachmentStates.values());
    const summary = states.reduce(
      (acc, attachment) => {
        acc[attachment.state] = (acc[attachment.state] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );
    return summary;
  }, [attachmentStates]);

  const renderItem = React.useCallback(
    ({ item }: { item: Asset & { source?: string } }) => (
      <AssetListItem
        asset={item}
        attachmentState={attachmentStates.get(item.id)}
      />
    ),
    [attachmentStates]
  );

  const keyExtractor = React.useCallback(
    (item: Asset & { source?: string }) => item.id,
    []
  );

  // Debug logging
  const logData = React.useMemo(
    () => ({
      questId: currentQuestId,
      isOnline,
      offlineAssetsCount: offlineAssets?.length ?? 0,
      cloudAssetsCount: cloudAssets?.length ?? 0,
      totalAssetsCount: assets.length,
      attachmentStatesCount: attachmentStates.size,
      sampleOfflineAsset: offlineAssets?.[0] ?? null,
      sampleCloudAsset: cloudAssets?.[0] ?? null,
      cloudError: cloudError?.message ?? null
    }),
    [
      currentQuestId,
      isOnline,
      offlineAssets?.length,
      cloudAssets?.length,
      assets.length,
      attachmentStates.size,
      cloudError?.message
    ]
  );

  React.useEffect(() => {
    console.log('[ASSETS VIEW]', logData);
  }, [logData]);

  const statusText = React.useMemo(
    () =>
      `${isOnline ? '🟢' : '🔴'} Offline: ${offlineAssets?.length ?? 0} | Cloud: ${isOnline ? (cloudAssets?.length ?? 0) : 'N/A'} | Total: ${assets.length}`,
    [isOnline, offlineAssets?.length, cloudAssets?.length, assets.length]
  );

  const attachmentSummaryText = React.useMemo(() => {
    return Object.entries(attachmentStateSummary)
      .map(([state, count]) => {
        const stateNames = {
          '0': '⏳ Queued',
          '1': '🔄 Syncing',
          '2': '✅ Synced',
          '3': '❌ Failed',
          '4': '📥 Downloading'
        };
        return `${stateNames[state as keyof typeof stateNames] || `State ${state}`}: ${count}`;
      })
      .join(' | ');
  }, [attachmentStateSummary]);

  if (isOfflineLoading || isCloudLoading) {
    return <ProjectListSkeleton />;
  }

  if (!currentQuestId) {
    return (
      <View style={sharedStyles.container}>
        <Text style={sharedStyles.title}>No Quest Selected</Text>
      </View>
    );
  }

  return (
    <View style={sharedStyles.container}>
      <Text style={sharedStyles.title}>Assets</Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSizes.small,
          marginBottom: spacing.small
        }}
      >
        {statusText}
        {cloudError && (
          <Text style={{ color: colors.error }}>
            {' '}
            | Cloud Error: {cloudError.message}
          </Text>
        )}
      </Text>

      {!isAttachmentStatesLoading && attachmentStates.size > 0 && (
        <View style={styles.attachmentSummary}>
          <Text style={styles.attachmentSummaryTitle}>
            📎 Live Attachment States:
          </Text>
          <Text style={styles.attachmentSummaryText}>
            {attachmentSummaryText}
          </Text>
        </View>
      )}

      <FlashList
        data={assets}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={80}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

export const styles = StyleSheet.create({
  listContainer: {
    paddingVertical: spacing.small
  },
  listItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.medium,
    marginBottom: spacing.small,
    gap: spacing.xsmall
  },
  assetName: {
    color: colors.text,
    fontSize: fontSizes.large,
    fontWeight: 'bold'
  },
  assetInfo: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  attachmentSummary: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.small,
    marginTop: spacing.small,
    marginBottom: spacing.small
  },
  attachmentSummaryTitle: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginBottom: spacing.xsmall
  },
  attachmentSummaryText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  }
});
