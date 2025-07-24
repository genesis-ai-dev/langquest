import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { asset, quest_asset_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { FlashList } from '@shopify/flash-list';
import { eq } from 'drizzle-orm';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AssetListItem } from './AssetListItem';
import { useHybridInfiniteData } from './useHybridData';

type Asset = typeof asset.$inferSelect;

export default function NextGenAssetsView() {
  const { currentQuestId } = useCurrentNavigation();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isOnline
  } = useHybridInfiniteData<Asset>({
    dataType: 'assets',
    queryKeyParams: [currentQuestId || ''],
    pageSize: 20,

    // Offline query function
    offlineQueryFn: async ({ pageParam, pageSize }) => {
      if (!currentQuestId) return [];

      const offset = pageParam * pageSize;

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
        .where(eq(quest_asset_link.quest_id, currentQuestId))
        .limit(pageSize)
        .offset(offset);

      return assets as Asset[];
    },

    // Cloud query function
    cloudQueryFn: async ({ pageParam, pageSize }) => {
      if (!currentQuestId) return [];

      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await system.supabaseConnector.client
        .from('quest_asset_link')
        .select(
          `
          asset:asset_id (
            *
          )
        `
        )
        .eq('quest_id', currentQuestId)
        .range(from, to)
        .overrideTypes<{ asset: Asset }[]>();

      if (error) throw error;
      return data.map((item) => item.asset);
    }
  });

  // Flatten all pages into a single array
  const assets = React.useMemo(() => {
    return data.pages.flatMap((page) => page.data);
  }, [data.pages]);

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

  const onEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderFooter = React.useCallback(() => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage]);

  const statusText = React.useMemo(() => {
    const offlineCount = assets.filter(
      (a) => a.source === 'localSqlite'
    ).length;
    const cloudCount = assets.filter(
      (a) => a.source === 'cloudSupabase'
    ).length;
    return `${isOnline ? '🟢' : '🔴'} Offline: ${offlineCount} | Cloud: ${isOnline ? cloudCount : 'N/A'} | Total: ${assets.length}`;
  }, [isOnline, assets]);

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

  // Debug logging
  const logData = React.useMemo(
    () => ({
      questId: currentQuestId,
      isOnline,
      totalAssetsCount: assets.length,
      attachmentStatesCount: attachmentStates.size,
      pagesLoaded: data.pages.length,
      hasMorePages: hasNextPage
    }),
    [
      currentQuestId,
      isOnline,
      assets.length,
      attachmentStates.size,
      data.pages.length,
      hasNextPage
    ]
  );

  React.useEffect(() => {
    console.log('[ASSETS VIEW]', logData);
  }, [logData]);

  if (isLoading) {
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
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
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
  },
  loadingFooter: {
    paddingVertical: spacing.medium,
    alignItems: 'center'
  }
});
