import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { Text } from '@/components/ui/text';
import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { mergeSQL, type WithSource } from '@/utils/dbUtils';
import { LegendList } from '@legendapp/list';
import { eq } from 'drizzle-orm';
import React from 'react';
import { View } from 'react-native';
import { QuestListItem } from './QuestListItem';
import { useHybridData } from './useHybridData';

export default function ProjectDirectoryView() {
  const { currentProjectId } = useCurrentNavigation();

  //   const { data: quests, isLoading } = useHybridData<Quest>({
  //     dataType: 'quests',
  //     queryKeyParams: [currentProjectId],
  //     offlineQuery: `SELECT * FROM ${resolveTable('quest', { localOverride: true })} WHERE project_id = '${currentProjectId}'`,
  //     cloudQueryFn: async () => {
  //       const { data, error } = await system.supabaseConnector.client
  //         .from('quest')
  //         .select('*')
  //         .eq('project_id', currentProjectId);

  //       if (error) {
  //         throw error;
  //       }

  //       return data || [];
  //     }
  //   });

  type Quest = typeof quest.$inferSelect;

  const offlineSQL = React.useMemo(() => {
    if (!currentProjectId) return null;
    return mergeSQL(
      system.db.query.quest.findMany({
        where: eq(quest.project_id, currentProjectId)
      })
    );
  }, [currentProjectId]);

  const { data: rawQuests, isLoading } = useHybridData<Quest>({
    dataType: 'quests',
    queryKeyParams: [currentProjectId ?? 'none'],
    offlineQuery:
      offlineSQL ??
      mergeSQL(
        system.db.query.quest.findMany({
          where: eq(quest.project_id, '__nil__')
        })
      ),
    enableOfflineQuery: Boolean(currentProjectId),
    cloudQueryFn: async () => {
      if (!currentProjectId) return [] as Quest[];
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('project_id', currentProjectId)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data ?? [];
    },
    enableCloudQuery: Boolean(currentProjectId),
    getItemId: (item) => item.id
  });

  const quests = React.useMemo(() => {
    const items = (rawQuests ?? []) as WithSource<Quest>[];

    // Build adjacency list by parent_id
    const childrenOf = new Map<string | null, WithSource<Quest>[]>();

    for (const q of items) {
      const key = (q as Quest).parent_id ?? null;
      if (!childrenOf.has(key)) childrenOf.set(key, []);
      childrenOf.get(key)!.push(q);
    }

    const sortByName = (a: WithSource<Quest>, b: WithSource<Quest>) =>
      (a.name || '').localeCompare(b.name || '', undefined, {
        sensitivity: 'base'
      });

    for (const arr of childrenOf.values()) {
      arr.sort(sortByName);
    }

    const roots = childrenOf.get(null) || [];

    const result: WithSource<Quest>[] = [];
    const visit = (node: WithSource<Quest>) => {
      result.push(node);
      const kids = childrenOf.get((node as Quest).id) || [];
      for (const child of kids) visit(child);
    };

    for (const r of roots) visit(r);

    // Handle items whose parent_id exists but parent not in list
    const attached = new Set(result.map((q) => q.id));
    const orphans = items.filter((q) => !attached.has(q.id));
    orphans.sort(sortByName);
    result.push(...orphans);

    return result;
  }, [rawQuests]);

  if (isLoading) {
    return <ProjectListSkeleton />;
  }

  return (
    <View className="flex-1 p-4">
      <View>
        <Text variant="h4" className="mb-4">
          Project Directory
        </Text>
      </View>
      <LegendList
        data={quests}
        keyExtractor={(quest) => quest.id}
        renderItem={({ item: quest }) => (
          <QuestListItem quest={quest} className="mb-4" />
        )}
        ListEmptyComponent={
          <Text className="text-center text-muted-foreground">
            No quests found
          </Text>
        }
      />
    </View>
  );
}
