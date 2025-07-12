import type { Quest } from '@/database_services/questService';
import type { Tag } from '@/database_services/tagService';
import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useHybridSupabaseInfiniteQuery } from '@/hooks/useHybridSupabaseQuery';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import type { SortingOption } from '@/views/QuestsView';
import { FlashList } from '@shopify/flash-list';
import { and, eq, like, or } from 'drizzle-orm';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { QuestItem } from './QuestItem';
import { QuestListSkeleton } from './QuestListSkeleton';
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

    const sortOrder = activeSorting[0]?.order;
    const sortField = activeSorting[0]?.field;

    // Define the quest type with tags
    type QuestWithTags = Quest & { tags: { tag: Tag }[] };

    // Use optimized query with better caching
    // const {
    //   data: infiniteData,
    //   isFetching,
    //   isFetchingNextPage,
    //   isLoading,
    //   isError,
    //   error,
    //   refetch
    // } = useHybridInfiniteQuery({
    //   queryKey: ['quests', 'by-project', projectId, sortField, sortOrder],
    //   onlineFn: async (pageParam, pageSize) => {
    //     const { data, error } = await system.supabaseConnector.client
    //       .from('quest')
    //       .select('*, tags:quest_tag_link(tag(*))')
    //       .eq('project_id', projectId)
    //       .order('created_at', { ascending: false })
    //       .limit(pageSize)
    //       .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1)
    //       .overrideTypes<
    //         (typeof quest.$inferSelect & {
    //           tags: { tag: typeof tag.$inferInsert }[];
    //         })[]
    //       >();
    //     if (error) throw error;
    //     return data;
    //   },
    //   offlineFn: async (pageParam, pageSize) => {
    //     return await system.db.query.quest.findMany({
    //       where: eq(quest.project_id, projectId),
    //       limit: pageSize,
    //       offset: pageParam * pageSize,
    //       ...(sortOrder &&
    //         sortField && {
    //           orderBy: (fields, { ...options }) =>
    //             options[sortOrder](fields[sortField as keyof typeof fields])
    //         }),
    //       with: {
    //         tags: {
    //           with: {
    //             tag: true
    //           }
    //         }
    //       }
    //     });
    //   },
    //   pageSize: 10
    // });

    const {
      data: infiniteData,
      isFetching,
      isFetchingNextPage,
      isLoading,
      isError,
      error,
      refetch,
      fetchNextPage,
      hasNextPage
    } = useHybridSupabaseInfiniteQuery<QuestWithTags>({
      queryKey: [
        'quests',
        'by-project',
        projectId,
        sortField,
        sortOrder,
        searchQuery,
        activeFilters
      ],
      onlineFn: async ({ pageParam, pageSize }) => {
        let query = system.supabaseConnector.client
          .from('quest')
          .select('*, tags:quest_tag_link(tag(*))')
          .eq('project_id', projectId);

        // Add search filtering
        if (searchQuery) {
          query = query.or(
            `name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
          );
        }

        // Add ordering
        query = query.order('created_at', { ascending: false });

        // Add pagination
        query = query
          .limit(pageSize)
          .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1);

        const { data, error } = await query.overrideTypes<QuestWithTags[]>();
        if (error) throw error;
        return data;
      },
      offlineFn: async ({ pageParam, pageSize }) => {
        const baseCondition = eq(quest.project_id, projectId);

        // Add search filtering for offline
        const whereConditions = searchQuery
          ? and(
              baseCondition,
              or(
                like(quest.name, `%${searchQuery}%`),
                like(quest.description, `%${searchQuery}%`)
              )
            )
          : baseCondition;

        return await system.db.query.quest.findMany({
          where: whereConditions,
          limit: pageSize,
          offset: pageParam * pageSize,
          with: {
            tags: {
              with: {
                tag: true
              }
            }
          }
        });
      },
      pageSize: 10
    });

    // Extract and memoize quests with tags
    const questsWithTags = useMemo(() => {
      return infiniteData.pages.flatMap((page) => page.data);
    }, [infiniteData.pages]);

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
            Error loading quests: {error?.message}
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
      <>
        <FlashList
          data={questsWithTags}
          renderItem={({ item }) => (
            <QuestItem
              quest={item}
              project={selectedProject}
              onPress={onQuestPress}
            />
          )}
          keyExtractor={(item: QuestWithTags) => item.id}
          style={sharedStyles.list}
          // Performance optimizations
          removeClippedSubviews={true}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
          }}
          ListFooterComponent={
            isFetchingNextPage && hasNextPage ? (
              <View style={QuestsScreenStyles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
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
      </>
    );
  }
);
