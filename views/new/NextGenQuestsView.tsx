import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { system } from '@/db/powersync/system';
import type { Quest } from '@/hooks/db/useQuests';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { QuestListItem } from './QuestListItem';
import { useSimpleHybridInfiniteData } from './useHybridData';

export default function NextGenQuestsView() {
  const { currentProjectId } = useCurrentNavigation();
  const [showMembershipModal, setShowMembershipModal] = React.useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isOnline
  } = useSimpleHybridInfiniteData<Quest>(
    'quests',
    [currentProjectId || ''],
    // Offline query function
    async ({ pageParam, pageSize }) => {
      if (!currentProjectId) return [];

      const offset = pageParam * pageSize;
      const quests = await system.db.query.quest.findMany({
        where: (fields, { eq }) => eq(fields.project_id, currentProjectId),
        limit: pageSize,
        offset
      });
      return quests;
    },
    // Cloud query function
    async ({ pageParam, pageSize }) => {
      if (!currentProjectId) return [];

      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('project_id', currentProjectId)
        .range(from, to)
        .overrideTypes<Quest[]>();

      if (error) throw error;
      return data;
    },
    20 // pageSize
  );

  // Flatten all pages into a single array
  const quests = React.useMemo(() => {
    return data.pages.flatMap((page) => page.data);
  }, [data.pages]);

  const renderItem = React.useCallback(
    ({ item }: { item: Quest & { source?: string } }) => (
      <QuestListItem quest={item} />
    ),
    []
  );

  const keyExtractor = React.useCallback(
    (item: Quest & { source?: string }) => item.id,
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
    const downloadedCount = quests.filter(
      (q) => q.source === 'localSqlite'
    ).length;
    const cloudCount = quests.filter(
      (q) => q.source === 'cloudSupabase'
    ).length;

    return `${isOnline ? '🟢' : '🔴'} Available: ${downloadedCount} | Needs Download: ${cloudCount} | Total: ${quests.length}`;
  }, [isOnline, quests]);

  if (isLoading) {
    return <ProjectListSkeleton />;
  }

  if (!currentProjectId) {
    return (
      <View style={sharedStyles.container}>
        <Text style={sharedStyles.title}>No Project Selected</Text>
      </View>
    );
  }

  return (
    <View style={sharedStyles.container}>
      <Text style={sharedStyles.title}>Quests</Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSizes.small,
          marginBottom: spacing.small
        }}
      >
        {statusText}
      </Text>
      <FlashList
        data={quests}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={80}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />

      {/* Floating action button for membership */}
      <TouchableOpacity
        onPress={() => setShowMembershipModal(true)}
        style={styles.floatingButton}
      >
        <Ionicons name="people" size={24} color={colors.text} />
      </TouchableOpacity>

      {/* Membership Modal */}
      <ProjectMembershipModal
        isVisible={showMembershipModal}
        onClose={() => setShowMembershipModal(false)}
        projectId={currentProjectId || ''}
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
  questName: {
    color: colors.text,
    fontSize: fontSizes.large,
    fontWeight: 'bold'
  },
  description: {
    color: colors.text,
    fontSize: fontSizes.medium,
    opacity: 0.8
  },
  loadingFooter: {
    paddingVertical: spacing.medium,
    alignItems: 'center'
  },
  floatingButton: {
    position: 'absolute',
    bottom: spacing.large,
    right: spacing.large,
    backgroundColor: colors.primary,
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  }
});
