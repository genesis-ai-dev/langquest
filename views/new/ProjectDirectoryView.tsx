import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { mergeSQL, resolveTable, type WithSource } from '@/utils/dbUtils';
// import { LegendList } from '@legendapp/list';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { eq } from 'drizzle-orm';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  Plus,
  Share2
} from 'lucide-react-native';
import React from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useHybridData } from './useHybridData';

export default function ProjectDirectoryView() {
  const { currentProjectId } = useCurrentNavigation();
  const { goToQuest } = useAppNavigation();
  const { currentUser } = useAuth();
  const { t } = useLocalization();
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
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [parentForNewQuest, setParentForNewQuest] = React.useState<
    string | null
  >(null);
  const [newQuestName, setNewQuestName] = React.useState('');

  const toggleExpanded = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openCreateForParent = React.useCallback((parentId: string | null) => {
    setParentForNewQuest(parentId);
    setNewQuestName('');
    setIsCreateOpen(true);
  }, []);

  const handleCreateSubquest = React.useCallback(async () => {
    if (!currentProjectId || !currentUser?.id || !parentForNewQuest) return;
    const name = newQuestName.trim();
    if (!name) return;
    try {
      await system.db
        .insert(resolveTable('quest', { localOverride: true }))
        .values({
          name,
          project_id: currentProjectId,
          parent_id: parentForNewQuest,
          creator_id: currentUser.id,
          download_profiles: [currentUser.id]
        });
      setIsCreateOpen(false);
      setParentForNewQuest(null);
      setNewQuestName('');
    } catch (e) {
      console.warn('Failed to create sub-quest', e);
    }
  }, [currentProjectId, currentUser?.id, newQuestName, parentForNewQuest]);

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
            <Pressable
              onPress={hasChildren ? () => toggleExpanded(id) : undefined}
              className="mr-1 w-8 p-1"
            >
              {hasChildren && (
                <Icon
                  as={isOpen ? ChevronDown : ChevronRight}
                  className="text-muted-foreground"
                />
              )}
            </Pressable>
            <Icon as={Folder} className="mr-2 text-muted-foreground" />
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
            {q.source === 'local' ? (
              <View className="ml-2 flex flex-row items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onPress={() =>
                    Alert.alert(
                      'Mock Publish',
                      'This is a mock public publish function.'
                    )
                  }
                >
                  <Icon as={Share2} />
                </Button>
              </View>
            ) : q.source === 'cloud' ? (
              <View className="ml-2 flex flex-row items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onPress={() =>
                    Alert.alert(
                      'Mock Download',
                      'This is a mock download function.'
                    )
                  }
                >
                  <Icon as={Download} />
                </Button>
              </View>
            ) : null}
            <Button
              size="icon"
              variant="outline"
              className="ml-2 h-7 w-7"
              onPress={() => openCreateForParent(id)}
            >
              <Icon as={Plus} />
            </Button>
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
    <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen} dismissible>
      <View className="flex-1 p-4">
        <View>
          <Text variant="h4" className="mb-4">
            {t('projectDirectory')}
          </Text>
        </View>
        <ScrollView>
          {roots.length === 0 ? (
            <Text className="text-center text-muted-foreground">
              {t('noQuestsFound')}
            </Text>
          ) : (
            <>
              <View className="gap-1">{renderTree(roots, 0)}</View>
              <Button
                onPress={() => openCreateForParent(null)}
                variant="outline"
                size="sm"
              >
                <Text>{t('createObject')}</Text>
              </Button>
            </>
          )}
        </ScrollView>
      </View>

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('newQuest')}</DrawerTitle>
        </DrawerHeader>
        <View className="gap-3 p-4">
          <Input
            value={newQuestName}
            onChangeText={setNewQuestName}
            placeholder={t('questName')}
            size="sm"
          />
        </View>
        <DrawerFooter>
          <Button
            onPress={handleCreateSubquest}
            disabled={!newQuestName.trim()}
          >
            <Text>{t('createObject')}</Text>
          </Button>
          <DrawerClose>
            <Text>{t('cancel')}</Text>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
