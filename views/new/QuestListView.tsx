import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import type { WithSource } from '@/utils/dbUtils';
import { LegendList } from '@legendapp/list';
import { and, eq, like, or } from 'drizzle-orm';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QuestTreeRow } from './QuestTreeRow';
import { useHybridInfiniteData } from './useHybridData';

interface QuestListViewProps {
  projectId: string;
  searchQuery: string;
  projectSource: 'local' | 'synced' | 'cloud';
  isMember: boolean;
  onAddChild: (parentId: string | null) => void;
  onDownloadClick: (questId: string) => void;
}

type Quest = typeof quest.$inferSelect;

export function QuestListView({
  projectId,
  searchQuery,
  projectSource,
  isMember,
  onAddChild,
  onDownloadClick
}: QuestListViewProps) {
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  const showHiddenContent = useLocalStore((state) => state.showHiddenContent);

  const PAGE_SIZE = 50;
  const trimmedSearch = searchQuery.trim();

  const questsInfiniteQuery = useHybridInfiniteData({
    dataType: 'quests',
    queryKeyParams: ['for-project', projectId, searchQuery],
    pageSize: PAGE_SIZE,
    offlineQueryFn: async ({ pageParam, pageSize }) => {
      const offset = pageParam * pageSize;

      const conditions = [
        eq(quest.project_id, projectId!),
        or(
          !showHiddenContent ? eq(quest.visible, true) : undefined,
          eq(quest.creator_id, currentUser!.id)
        ),
        trimmedSearch &&
          or(
            like(quest.name, `%${trimmedSearch}%`),
            like(quest.description, `%${trimmedSearch}%`)
          )
      ].filter(Boolean);

      const results = await system.db.query.quest.findMany({
        columns: {
          id: true,
          name: true,
          description: true,
          parent_id: true,
          source: true,
          visible: true
        },
        where: and(...conditions),
        limit: pageSize,
        offset: offset
      });
      return results;
    },
    cloudQueryFn: async ({ pageParam, pageSize }) => {
      const offset = pageParam * pageSize;

      let query = system.supabaseConnector.client
        .from('quest')
        .select('id, name, description, parent_id, visible')
        .eq('project_id', projectId);

      if (trimmedSearch) {
        query = query.or(
          `name.ilike.%${trimmedSearch}%,description.ilike.%${trimmedSearch}%`
        );
      }

      const { data, error } = await query
        .range(offset, offset + pageSize - 1)
        .overrideTypes<
          { id: string; name: string; description: string; parent_id: string }[]
        >();

      if (error) throw error;
      return data;
    },
    enableCloudQuery: projectSource !== 'local',
    offlineQueryOptions: {
      enabled: !!projectId
    }
  });

  // Flatten all pages into single array for tree building
  const rawQuests = React.useMemo(() => {
    return questsInfiniteQuery.data.pages.flatMap((page) => page.data);
  }, [questsInfiniteQuery.data.pages]);

  const { childrenOf, roots } = React.useMemo(() => {
    const items = rawQuests;

    const children = new Map<string | null, WithSource<Quest>[]>();
    for (const q of items) {
      const key = q.parent_id ?? null;
      if (!children.has(key)) children.set(key, []);
      // @ts-expect-error - expected type mismatch
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
          <QuestTreeRow
            key={id}
            quest={q}
            depth={depth}
            hasChildren={hasChildren}
            isOpen={isOpen}
            canCreateNew={isMember}
            onToggleExpand={() => toggleExpanded(id)}
            onAddChild={(parentId) => onAddChild(parentId)}
            onDownloadClick={onDownloadClick}
          />
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
    [
      childrenOf,
      expanded,
      toggleExpanded,
      onAddChild,
      onDownloadClick,
      isMember
    ]
  );

  if (questsInfiniteQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (roots.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-center text-muted-foreground">
          {t('noQuestsFound')}
        </Text>
      </View>
    );
  }

  return (
    <LegendList
      data={roots}
      keyExtractor={(item) => item.id}
      estimatedItemSize={60}
      renderItem={({ item: q }) => {
        const id = q.id;
        const hasChildren = (childrenOf.get(id) || []).length > 0;
        const isOpen = expanded.has(id);
        return (
          <View key={id}>
            <QuestTreeRow
              quest={q}
              depth={0}
              hasChildren={hasChildren}
              isOpen={isOpen}
              canCreateNew={isMember}
              onToggleExpand={() => toggleExpanded(id)}
              onAddChild={(parentId) => onAddChild(parentId)}
              onDownloadClick={onDownloadClick}
            />
            {hasChildren && isOpen && (
              <View>{renderTree(childrenOf.get(id) || [], 1)}</View>
            )}
          </View>
        );
      }}
      onEndReached={() => {
        if (
          questsInfiniteQuery.hasNextPage &&
          !questsInfiniteQuery.isFetchingNextPage
        ) {
          questsInfiniteQuery.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        questsInfiniteQuery.isFetchingNextPage ? (
          <View className="p-4">
            <ActivityIndicator size="small" />
          </View>
        ) : null
      }
    />
  );
}
