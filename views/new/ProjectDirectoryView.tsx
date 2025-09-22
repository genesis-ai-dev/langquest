import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { Text } from '@/components/ui/text';
import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { mergeSQL, type WithSource } from '@/utils/dbUtils';
// import { LegendList } from '@legendapp/list';
import { Icon } from '@/components/ui/icon';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { eq } from 'drizzle-orm';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder
} from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useHybridData } from './useHybridData';

export default function ProjectDirectoryView() {
  const { currentProjectId } = useCurrentNavigation();
  const { goToQuest } = useAppNavigation();

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

  const { childrenOf, roots } = React.useMemo(() => {
    const items = (rawQuests ?? []) as WithSource<Quest>[];

    const children = new Map<string | null, WithSource<Quest>[]>();
    for (const q of items) {
      const key = (q as Quest).parent_id ?? null;
      if (!children.has(key)) children.set(key, []);
      children.get(key)!.push(q);
    }

    const sortByName = (a: WithSource<Quest>, b: WithSource<Quest>) =>
      (a.name || '').localeCompare(b.name || '', undefined, {
        sensitivity: 'base'
      });
    for (const arr of children.values()) arr.sort(sortByName);

    return { childrenOf: children, roots: children.get(null) || [] };
  }, [rawQuests]);

  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggleExpanded = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderTree = React.useCallback(
    (nodes: WithSource<Quest>[], depth: number): React.ReactNode => {
      const rows: React.ReactNode[] = [];
      for (const q of nodes) {
        const id = q.id;
        const hasChildren = (childrenOf.get(id) || []).length > 0;
        const isOpen = expanded.has(id);
        rows.push(
          <View
            key={id}
            className="flex flex-row items-center py-1"
            style={{ paddingLeft: depth * 12 }}
          >
            {hasChildren ? (
              <Pressable
                onPress={() => toggleExpanded(id)}
                className="mr-1 p-1"
              >
                <Icon
                  as={isOpen ? ChevronDown : ChevronRight}
                  className="text-muted-foreground"
                />
              </Pressable>
            ) : (
              <View className="mr-1 p-1" />
            )}
            <Icon
              as={hasChildren ? Folder : FileText}
              className="mr-2 text-muted-foreground"
            />
            <Pressable
              className="flex-1"
              onPress={() =>
                goToQuest({ id: q.id, project_id: q.project_id, name: q.name })
              }
            >
              <Text numberOfLines={1}>{q.name}</Text>
              {!!(q as Quest).parent_id && (
                <Text
                  className="text-xs text-muted-foreground"
                  numberOfLines={1}
                >
                  Parent: {(q as Quest).parent_id}
                </Text>
              )}
            </Pressable>
          </View>
        );
        if (hasChildren && isOpen) {
          rows.push(
            <View key={`${id}-children`}>
              {renderTree(childrenOf.get(id) || [], depth + 1)}
            </View>
          );
        }
      }
      return rows;
    },
    [childrenOf, expanded, goToQuest, toggleExpanded]
  );

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
      <ScrollView>
        {roots.length === 0 ? (
          <Text className="text-center text-muted-foreground">
            No quests found
          </Text>
        ) : (
          <View className="gap-1">{renderTree(roots, 0)}</View>
        )}
      </ScrollView>
    </View>
  );
}
