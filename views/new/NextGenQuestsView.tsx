import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { system } from '@/db/powersync/system';
import type { Quest } from '@/hooks/db/useQuests';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { QuestListItem } from './QuestListItem';

function useNextGenOfflineQuests(projectId: string) {
  return useQuery({
    queryKey: ['quests', 'offline', projectId],
    queryFn: async () => {
      const quests = await system.db.query.quest.findMany({
        where: (fields, { eq }) => eq(fields.project_id, projectId)
      });
      return quests.map((quest) => ({
        ...quest,
        source: 'localSqlite'
      }));
    },
    enabled: !!projectId
  });
}

function useNextGenCloudQuests(projectId: string, isOnline: boolean) {
  return useQuery({
    queryKey: ['quests', 'cloud', projectId],
    queryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('project_id', projectId)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data.map((quest) => ({
        ...quest,
        source: 'cloudSupabase'
      }));
    },
    enabled: !!projectId && isOnline // Only run when online and have projectId
  });
}

export default function NextGenQuestsView() {
  const { currentProjectId } = useCurrentNavigation();
  const isOnline = useNetworkStatus();

  const { data: offlineQuests, isLoading: isOfflineLoading } =
    useNextGenOfflineQuests(currentProjectId || '');
  const {
    data: cloudQuests,
    isLoading: isCloudLoading,
    error: cloudError
  } = useNextGenCloudQuests(currentProjectId || '', isOnline);

  // Combine quests with offline taking precedence for duplicates
  const quests = React.useMemo(() => {
    const offlineQuestsArray = offlineQuests || [];
    const cloudQuestsArray = cloudQuests || [];

    // Create a map of offline quests by ID for quick lookup
    const offlineQuestMap = new Map(
      offlineQuestsArray.map((quest) => [quest.id, quest])
    );

    // Add cloud quests that don't exist in offline
    const uniqueCloudQuests = cloudQuestsArray.filter(
      (quest) => !offlineQuestMap.has(quest.id)
    );

    // Return offline quests first, then unique cloud quests
    return [...offlineQuestsArray, ...uniqueCloudQuests];
  }, [offlineQuests, cloudQuests]);

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

  const statusText = React.useMemo(
    () =>
      `${isOnline ? '🟢' : '🔴'} Offline: ${offlineQuests?.length ?? 0} | Cloud: ${isOnline ? (cloudQuests?.length ?? 0) : 'N/A'} | Total: ${quests.length}`,
    [isOnline, offlineQuests?.length, cloudQuests?.length, quests.length]
  );

  if (isOfflineLoading || isCloudLoading) {
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
        {cloudError && (
          <Text style={{ color: colors.error }}>
            {' '}
            | Cloud Error: {cloudError.message}
          </Text>
        )}
      </Text>
      <FlashList
        data={quests}
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
  questName: {
    color: colors.text,
    fontSize: fontSizes.large,
    fontWeight: 'bold'
  },
  description: {
    color: colors.text,
    fontSize: fontSizes.medium,
    opacity: 0.8
  }
});
