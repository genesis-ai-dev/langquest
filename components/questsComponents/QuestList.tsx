import type { Quest } from '@/database_services/questService';
import type { Tag } from '@/database_services/tagService';
import { useProjectById } from '@/hooks/db/useProjects';
import { useInfiniteQuestsWithTagsByProjectId } from '@/hooks/db/useQuests';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { FlashList } from '@shopify/flash-list';
import React, { useMemo } from 'react';
import { RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import type { SortingOption } from '../../app/(root)/_(drawer)/(stack)/projects/[projectId]/quests';
import { filterQuests } from '../../app/(root)/_(drawer)/(stack)/projects/[projectId]/quests';
import { QuestItem } from './QuestItem';
import { QuestListSkeleton } from './QuestListSkeleton';
import { QuestSkeleton } from './QuestSkeleton';
import { QuestsScreenStyles } from './QuestsScreenStyles';

// Main quest list component with performance optimizations
export const QuestList = React.memo(
  ({
    projectId,
    activeSorting,
    searchQuery,
    activeFilters,
    onQuestPress
  }: {
    projectId: string;
    activeSorting: SortingOption[];
    searchQuery: string;
    activeFilters: Record<string, string[]>;
    onQuestPress: (quest: Quest) => void;
  }) => {
    const { project: selectedProject } = useProjectById(projectId);

    // FIXED: Stabilize sorting parameters to prevent infinite loops
    const stableSortField = React.useMemo(() => {
      return activeSorting[0]?.field === 'name'
        ? activeSorting[0].field
        : undefined;
    }, [activeSorting]);

    const stableSortOrder = React.useMemo(() => {
      return activeSorting[0]?.order;
    }, [activeSorting]);

    // Use optimized query with better caching
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
    } = useInfiniteQuestsWithTagsByProjectId(
      projectId,
      15, // Reduced page size for faster initial load
      stableSortField,
      stableSortOrder
    );

    // Handle load more internally instead of relying on parent
    const handleLoadMore = React.useCallback(() => {
      if (hasNextPage && !isFetchingNextPage && !isFetching) {
        void fetchNextPage();
      }
    }, [hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

    // Extract and memoize quests with better performance
    const { /* allQuests, questTags, */ filteredQuests } = useMemo(() => {
      const quests = infiniteData?.pages.length
        ? infiniteData.pages.flatMap((page) => page.data)
        : [];

      const tags = quests.length
        ? quests.reduce(
            (acc, quest) => {
              const questTags = quest.tags as { tag: Tag }[] | undefined;
              acc[quest.id] = questTags?.map((tag) => tag.tag) ?? [];
              return acc;
            },
            {} as Record<string, Tag[]>
          )
        : {};

      const filtered =
        quests.length && (searchQuery || Object.keys(activeFilters).length > 0)
          ? filterQuests(
              quests as (Quest & { tags: { tag: Tag }[] })[],
              tags,
              searchQuery,
              activeFilters
            )
          : quests;

      return {
        allQuests: quests,
        questTags: tags,
        filteredQuests: filtered
      };
    }, [
      infiniteData?.pages.length, // Use length instead of array reference
      searchQuery,
      JSON.stringify(activeFilters) // Serialize object for stable comparison
    ]);

    // Show skeleton during initial load
    if (isLoading) {
      return <QuestListSkeleton />;
    }

    // Show error state
    if (isError) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.large
          }}
        >
          <Text
            style={{
              color: colors.error,
              textAlign: 'center',
              marginBottom: spacing.medium
            }}
          >
            Error loading quests: {error.message}
          </Text>
          <TouchableOpacity
            onPress={() => void refetch()}
            style={QuestsScreenStyles.retryButton}
          >
            <Text style={QuestsScreenStyles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlashList
        data={filteredQuests}
        renderItem={({ item }) => (
          <QuestItem
            quest={item as Quest & { tags: { tag: Tag }[] }}
            project={selectedProject}
            onPress={onQuestPress}
          />
        )}
        keyExtractor={(item) => item.id}
        style={sharedStyles.list}
        // Performance optimizations
        removeClippedSubviews={true}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={{ paddingVertical: spacing.medium }}>
              <QuestSkeleton />
              <QuestSkeleton />
              <QuestSkeleton />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isFetchingNextPage}
            onRefresh={() => void refetch()}
            tintColor={colors.text}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    );
  }
);
