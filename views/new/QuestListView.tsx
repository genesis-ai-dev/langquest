import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import type { WithSource } from '@/utils/dbUtils';
import { useThemeColor } from '@/utils/styleUtils';
import { LegendList } from '@legendapp/list';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, asc, eq, like, or } from 'drizzle-orm';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QuestTreeRow } from './QuestTreeRow';
import { useHybridPaginatedInfiniteData } from './useHybridData';

interface QuestListViewProps {
  projectId: string;
  searchQuery: string;
  projectSource: 'local' | 'synced' | 'cloud';
  isMember: boolean;
  onAddChild: (parentId: string | null) => void;
  onDownloadClick: (questId: string) => void;
  onCloudLoadingChange?: (isLoading: boolean) => void;
  onFetchingChange?: (isFetching: boolean) => void;
  downloadingQuestId?: string | null;
  downloadingQuestIds?: Set<string>;
}

type Quest = typeof quest.$inferSelect;

// Lightweight skeleton for quest rows during loading
function QuestRowSkeleton() {
  return (
    <View className="flex-row items-center gap-2 border-b border-border py-2">
      <Skeleton style={{ width: 20, height: 20, borderRadius: 4 }} />
      <Skeleton style={{ width: 200, height: 16, borderRadius: 4 }} />
    </View>
  );
}

export function QuestListView({
  projectId,
  searchQuery,
  projectSource,
  isMember,
  onAddChild,
  onDownloadClick,
  onCloudLoadingChange,
  onFetchingChange,
  downloadingQuestId,
  downloadingQuestIds = new Set()
}: QuestListViewProps) {
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  const showHiddenContent = useLocalStore((state) => state.showHiddenContent);

  const PAGE_SIZE = 30;
  const trimmedSearch = searchQuery.trim();

  const questsInfiniteQuery = useHybridPaginatedInfiniteData({
    dataType: 'quests',
    queryKeyParams: ['for-project', projectId, searchQuery],
    pageSize: PAGE_SIZE,
    offlineQuery: ({ page, pageSize }) => {
      const offset = page * pageSize;

      const conditions = [
        eq(quest.project_id, projectId),
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

      return toCompilableQuery(
        system.db.query.quest.findMany({
          columns: {
            id: true,
            name: true,
            description: true,
            parent_id: true,
            source: true,
            visible: true,
            download_profiles: true
          },
          where: and(...conditions),
          orderBy: [asc(quest.name)],
          limit: pageSize,
          offset: offset
        })
      );
    },
    cloudQueryFn: async ({ page, pageSize }) => {
      const offset = page * pageSize;

      let query = system.supabaseConnector.client
        .from('quest')
        .select('id, name, description, parent_id, visible, download_profiles')
        .eq('project_id', projectId);

      // Match offline query filtering: show visible quests OR quests created by current user
      // When showHiddenContent is false, filter to visible quests OR user's quests
      // Note: Supabase doesn't easily support complex OR conditions, so we filter by visible
      // which matches most other hooks. User's own hidden quests will still appear when showHiddenContent=true
      if (!showHiddenContent) {
        query = query.or(`visible.eq.true,creator_id.eq.${currentUser!.id}`);
      }

      if (trimmedSearch) {
        // For search, we need to AND it with the existing filters
        // So: (project_id = X) AND (visible = true OR creator_id = user) AND (name ILIKE search OR description ILIKE search)
        // Supabase chain filter syntax treats chained filters as AND
        query = query.or(
          `name.ilike.%${trimmedSearch}%,description.ilike.%${trimmedSearch}%`
        );
      }

      // Add ordering to ensure consistent pagination
      query = query.order('name', { ascending: true });

      const { data, error } = await query
        .range(offset, offset + pageSize - 1)
        .overrideTypes<
          { id: string; name: string; description: string; parent_id: string }[]
        >();

      if (error) throw error;
      return data;
    },
    enableCloudQuery: projectSource !== 'local',
    enableOfflineQuery: projectSource === 'local',
    enabled: !!projectId
  });

  // Notify parent of cloud loading state
  React.useEffect(() => {
    onCloudLoadingChange?.(questsInfiniteQuery.isCloudLoading);
  }, [questsInfiniteQuery.isCloudLoading, onCloudLoadingChange]);

  // Notify parent of fetching state for search indicator
  React.useEffect(() => {
    onFetchingChange?.(questsInfiniteQuery.isFetching);
  }, [questsInfiniteQuery.isFetching, onFetchingChange]);

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

    // No client-side sorting - rely on SQL ordering from database queries
    // Data is already sorted by name (ascending) from the database
    // prevents sorting issues with pagination

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
            downloadingQuestId={downloadingQuestId}
            downloadingQuestIds={downloadingQuestIds}
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
      isMember,
      downloadingQuestId,
      downloadingQuestIds
    ]
  );

  const primaryColor = useThemeColor('primary');

  // Show skeleton rows during initial offline loading only
  if (questsInfiniteQuery.isOfflineLoading) {
    return (
      <View className="flex-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <QuestRowSkeleton key={i} />
        ))}
      </View>
    );
  }

  // Show empty state only when NOT loading and no results
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
      estimatedItemSize={40}
      maintainVisibleContentPosition
      recycleItems
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
              downloadingQuestId={downloadingQuestId}
              downloadingQuestIds={downloadingQuestIds}
            />
            {hasChildren && isOpen && (
              <View>{renderTree(childrenOf.get(id) || [], 1)}</View>
            )}
          </View>
        );
      }}
      onEndReached={questsInfiniteQuery.fetchNextPage}
      ListFooterComponent={
        questsInfiniteQuery.isFetchingNextPage ? (
          <View className="p-4">
            <ActivityIndicator size="small" color={primaryColor} />
          </View>
        ) : null
      }
    />
  );
}
