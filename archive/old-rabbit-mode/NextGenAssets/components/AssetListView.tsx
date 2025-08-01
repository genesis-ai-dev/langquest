import type { asset } from '@/db/drizzleSchema';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { AssetListItem } from '@/views/new/AssetListItem';
import { FlashList } from '@shopify/flash-list';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type Asset = typeof asset.$inferSelect;

interface AssetListViewProps {
  assets: (Asset & { source?: string })[];
  attachmentStates: Map<string, any>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  searchQuery: string;
  isOnline: boolean;
  onEndReached: () => void;
}

export const AssetListView: React.FC<AssetListViewProps> = ({
  assets,
  attachmentStates,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  searchQuery,
  isOnline,
  onEndReached
}) => {
  const { t } = useLocalization();

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

  const attachmentSummaryText = React.useMemo(() => {
    return Object.entries(attachmentStateSummary)
      .map(([state, count]) => {
        const stateNames = {
          '0': `⏳ ${t('queued')}`,
          '1': `🔄 ${t('syncing')}`,
          '2': `✅ ${t('synced')}`,
          '3': `❌ ${t('failed')}`,
          '4': `📥 ${t('downloading')}`
        };
        return `${stateNames[state as keyof typeof stateNames] || `${t('state')} ${state}`}: ${count}`;
      })
      .join(' | ');
  }, [attachmentStateSummary, t]);

  if (isLoading && searchQuery) {
    return (
      <View style={styles.searchingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.searchingText}>{t('searching')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {SHOW_DEV_ELEMENTS && <Text style={styles.statusText}>{statusText}</Text>}

      {SHOW_DEV_ELEMENTS && attachmentStates.size > 0 && (
        <View style={styles.attachmentSummary}>
          <Text style={styles.attachmentSummaryTitle}>
            📎 {t('liveAttachmentStates')}:
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No assets found' : 'No assets available'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    paddingVertical: spacing.small
  },
  loadingFooter: {
    paddingVertical: spacing.medium,
    alignItems: 'center'
  },
  searchingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xlarge
  },
  searchingText: {
    marginTop: spacing.medium,
    color: colors.textSecondary,
    fontSize: fontSizes.medium
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xlarge
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSizes.medium
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    marginBottom: spacing.small
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
