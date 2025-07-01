import { AssetFilterModal } from '@/components/AssetFilterModal';
import { DownloadIndicator } from '@/components/DownloadIndicator';
import { GemIcon } from '@/components/GemIcon';
import { PageHeader } from '@/components/PageHeader';
import PickaxeIcon from '@/components/PickaxeIcon';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { QuestDetails } from '@/components/QuestDetails';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import type { Asset } from '@/database_services/assetService';
import type { Tag } from '@/database_services/tagService';
import type { asset_content_link } from '@/db/drizzleSchema';
import { useAttachmentAssetDownloadStatus } from '@/hooks/useAssetDownloadStatus';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { getGemColor, shouldCountTranslation } from '@/utils/progressUtils';
import { sortItems } from '@/utils/sortingUtils';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useGlobalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AssetContent } from '@/hooks/db/useAssets';
import { useInfiniteAssetsWithTagsAndContentByQuestId } from '@/hooks/db/useAssets';
import { useQuestById } from '@/hooks/db/useQuests';
import { useTranslationsWithVotesByAssetId } from '@/hooks/db/useTranslations';
import { useDownload } from '@/hooks/useDownloads';
import { useLocalization } from '@/hooks/useLocalization';

interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

type AggregatedGems = Record<string, number>;

// Helper functions outside component to prevent recreation
const filterAssets = (
  assets: Asset[],
  assetTags: Record<string, Tag[]>,
  assetContents: Record<string, (typeof asset_content_link.$inferSelect)[]>,
  searchQuery: string,
  activeFilters: Record<string, string[]>
) => {
  return assets.filter((asset) => {
    // Search filter
    const assetContent = assetContents[asset.id] ?? [];
    const matchesSearch =
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assetContent.some((content) =>
        content.text.toLowerCase().includes(searchQuery.toLowerCase())
      );

    // Tag filters
    const assetTagList = assetTags[asset.id] ?? [];
    const matchesFilters = Object.entries(activeFilters).every(
      ([category, selectedOptions]) => {
        if (selectedOptions.length === 0) return true;
        return assetTagList.some((tag) => {
          const [tagCategory, tagValue] = tag.name.split(':');
          return (
            tagCategory?.toLowerCase() === category.toLowerCase() &&
            selectedOptions.includes(
              `${category.toLowerCase()}:${tagValue?.toLowerCase()}`
            )
          );
        });
      }
    );

    return matchesSearch && matchesFilters;
  });
};

function AssetCard({ asset }: { asset: Asset }) {
  const { currentUser } = useAuth();
  const { activeProject } = useProjectContext();
  const { isDownloaded: assetsDownloaded, isLoading: isLoadingDownloadStatus } =
    useAttachmentAssetDownloadStatus([asset.id]);

  const {
    isDownloaded,
    isLoading: isDownloadLoading,
    toggleDownload
  } = useDownload('asset', asset.id);

  const { translationsWithVotes } = useTranslationsWithVotesByAssetId(asset.id);

  const handleDownloadToggle = async () => {
    await toggleDownload();
  };

  // Aggregate translations by gem color
  const aggregatedGems = translationsWithVotes?.reduce<AggregatedGems>(
    (acc, translation) => {
      // Only count translations that should be displayed
      if (!shouldCountTranslation(translation.votes)) {
        return acc;
      }

      const gemColor = getGemColor(
        translation,
        translation.votes,
        currentUser?.id ?? null
      );

      acc[gemColor] = (acc[gemColor] ?? 0) + 1;

      return acc;
    },
    {}
  );

  return (
    <View style={sharedStyles.card}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.small
        }}
      >
        <Text style={[sharedStyles.cardTitle, { flex: 1 }]}>{asset.name}</Text>
        <PrivateAccessGate
          projectId={activeProject?.id || ''}
          projectName={activeProject?.name || ''}
          isPrivate={activeProject?.private || false}
          action="download"
          allowBypass={true}
          onBypass={handleDownloadToggle}
          renderTrigger={({ onPress, hasAccess }) => (
            <DownloadIndicator
              isDownloaded={isDownloaded && assetsDownloaded}
              isLoading={isLoadingDownloadStatus || isDownloadLoading}
              onPress={
                hasAccess || isDownloaded ? handleDownloadToggle : onPress
              }
            />
          )}
        />
      </View>
      <View style={styles.translationCount}>
        {aggregatedGems &&
          Object.entries(aggregatedGems).map(([color, count]) => (
            <View key={color} style={styles.gemContainer}>
              {count < 4 ? (
                // If count is less than 4, display that many gems
                Array.from({ length: count }).map((_, index) =>
                  color === colors.alert ? (
                    <PickaxeIcon
                      key={index}
                      color={color}
                      width={26}
                      height={20}
                    />
                  ) : (
                    <GemIcon key={index} color={color} width={26} height={20} />
                  )
                )
              ) : (
                // If count is 4 or more, display one gem with the count
                <>
                  {color === colors.alert ? (
                    <PickaxeIcon color={color} width={26} height={20} />
                  ) : (
                    <GemIcon color={color} width={26} height={20} />
                  )}
                  <Text style={{ ...styles.gemCount, marginRight: 8 }}>
                    {count}
                  </Text>
                </>
              )}
            </View>
          ))}
      </View>
    </View>
  );
}

export default function Assets() {
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const { t } = useLocalization();
  const { goToAsset } = useProjectContext();
  const { questId, projectId } = useGlobalSearchParams<{
    questId: string;
    projectId: string;
  }>();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {}
  );
  const [activeSorting, setActiveSorting] = useState<SortingOption[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showQuestStats, setShowQuestStats] = useState(false);

  const { quest } = useQuestById(questId);

  // Use the new hybrid infinite query hook for better performance and offline support
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch
  } = useInfiniteAssetsWithTagsAndContentByQuestId(
    questId,
    20, // pageSize
    activeSorting[0]?.field === 'name' ? activeSorting[0].field : undefined,
    activeSorting[0]?.order
  );

  // Extract all assets from pages and apply client-side filtering
  const allAssets = useMemo(() => {
    if (!infiniteData?.pages) return [];
    return infiniteData.pages.flatMap((page) => page.data);
  }, [infiniteData]);

  // Apply client-side filtering and sorting (consider moving search to server-side for better performance)
  const filteredAssets = useMemo(() => {
    if (!allAssets.length) return [];

    const assetTagsRecord: Record<string, Tag[]> = {};
    const assetContentsRecord: Record<string, AssetContent[]> = {};

    // Build the records with proper typing
    allAssets.forEach((asset) => {
      assetTagsRecord[asset.id] = asset.tags.map((tag) => tag.tag);
      assetContentsRecord[asset.id] = asset.content;
    });

    const filtered = filterAssets(
      allAssets,
      assetTagsRecord,
      assetContentsRecord,
      searchQuery,
      activeFilters
    );

    // Apply additional sorting if needed (beyond what's handled by the query)
    return sortItems(
      filtered,
      activeSorting,
      (assetId: string) => assetTagsRecord[assetId] ?? []
    );
  }, [allAssets, searchQuery, activeFilters, activeSorting]);

  const getActiveOptionsCount = () => {
    const filterCount = Object.values(activeFilters).flat().length;
    const sortCount = activeSorting.length;
    return filterCount + sortCount;
  };

  const handleAssetPress = (asset: Asset) => {
    goToAsset({ asset, questId, projectId });
  };

  const handleCloseDetails = () => {
    setSelectedAsset(null);
    setShowQuestStats(false);
  };

  const handleApplyFilters = (filters: Record<string, string[]>) => {
    setActiveFilters(filters);
    setIsFilterModalVisible(false);
  };

  const handleApplySorting = (sorting: SortingOption[]) => {
    setActiveSorting(sorting);
  };

  const toggleQuestStats = () => {
    setShowQuestStats((prev) => !prev);
  };

  // Load more data when user reaches end of list - TKDodo's best practice
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetching) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

  // Refresh data
  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Render footer with loading indicator - TKDodo's pattern
  const renderFooter = () => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  // Handle back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isFilterModalVisible) {
          setIsFilterModalVisible(false);
          return true;
        }
        if (selectedAsset) {
          setSelectedAsset(null);
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [isFilterModalVisible, selectedAsset]);

  // Loading state with better UX
  if (isLoading) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <View
            style={[
              sharedStyles.container,
              {
                backgroundColor: 'transparent',
                justifyContent: 'center',
                alignItems: 'center'
              }
            ]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={{
                color: colors.text,
                fontSize: fontSizes.medium,
                marginTop: spacing.medium
              }}
            >
              Loading assets...
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Error state with retry option
  if (isError) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <View
            style={[
              sharedStyles.container,
              {
                backgroundColor: 'transparent',
                justifyContent: 'center',
                alignItems: 'center'
              }
            ]}
          >
            <Text
              style={{
                color: colors.error,
                fontSize: fontSizes.medium,
                textAlign: 'center'
              }}
            >
              Error loading assets: {error.message}
            </Text>
            <TouchableOpacity
              onPress={handleRefresh}
              style={[styles.retryButton, { marginTop: spacing.medium }]}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View
          style={[sharedStyles.container, { backgroundColor: 'transparent' }]}
        >
          <PageHeader title={quest?.name ?? ''} />
          <View style={styles.headerContainer}>
            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color={colors.text}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={t('searchAssets')}
                placeholderTextColor={colors.text}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity
                onPress={() => setIsFilterModalVisible(true)}
                style={styles.filterIcon}
              >
                <Ionicons name="filter" size={20} color={colors.text} />
                {getActiveOptionsCount() > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {getActiveOptionsCount()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={filteredAssets}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleAssetPress(item)}>
                <AssetCard asset={item} />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            style={sharedStyles.list}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isFetchingNextPage}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
            // Performance optimizations from TKDodo's guide
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={100}
            initialNumToRender={10}
            windowSize={10}
          />
          <TouchableOpacity
            onPress={toggleQuestStats}
            style={styles.statsButton}
          >
            <Ionicons name="stats-chart" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <Modal
        visible={isFilterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={{ flex: 1 }}>
          {allAssets.length > 0 && (
            <AssetFilterModal
              visible={isFilterModalVisible}
              onClose={() => setIsFilterModalVisible(false)}
              assets={allAssets}
              onApplyFilters={handleApplyFilters}
              onApplySorting={handleApplySorting}
              initialFilters={activeFilters}
              initialSorting={activeSorting}
            />
          )}
        </View>
      </Modal>
      {showQuestStats && quest && (
        <QuestDetails quest={quest} onClose={handleCloseDetails} />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'column',
    marginBottom: spacing.medium,
    width: '100%'
  },
  statsButton: {
    padding: spacing.small,
    alignSelf: 'flex-end'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.medium,
    marginTop: spacing.medium,
    marginBottom: spacing.medium,
    width: '100%'
  },
  searchIcon: {
    marginRight: spacing.small
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.medium,
    paddingVertical: spacing.medium
  },
  filterIcon: {
    marginLeft: spacing.small,
    padding: spacing.small,
    position: 'relative'
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  badgeText: {
    color: colors.buttonText,
    fontSize: fontSizes.small,
    fontWeight: 'bold'
  },
  tag: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.small,
    marginRight: spacing.small
  },
  translationCount: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    marginTop: spacing.small,
    gap: spacing.xsmall
  },
  gemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall,
    justifyContent: 'center'
  },
  gemCount: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    gap: spacing.small
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.medium
  },
  retryButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  }
});
