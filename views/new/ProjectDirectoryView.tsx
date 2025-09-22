import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import type { WithSource } from '@/utils/dbUtils';
import { resolveTable, toMergeCompilableQuery } from '@/utils/dbUtils';
// import { LegendList } from '@legendapp/list';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormSubmit,
  transformInputProps
} from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  FolderPenIcon,
  Plus,
  Share2Icon
} from 'lucide-react-native';
import React from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Pressable, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import z from 'zod';
import { useHybridData } from './useHybridData';

export default function ProjectDirectoryView() {
  const { currentProjectId } = useCurrentNavigation();
  const { goToQuest } = useAppNavigation();
  const { currentUser } = useAuth();
  const { t } = useLocalization();

  type Quest = typeof quest.$inferSelect;

  const formSchema = z.object({
    name: z.string(t('nameRequired')).nonempty(t('nameRequired')).trim(),
    description: z.string().max(196).trim().optional()
  });
  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema)
  });

  const { data: rawQuests, isLoading } = useHybridData({
    dataType: 'quests',
    queryKeyParams: [currentProjectId],
    offlineQuery: toMergeCompilableQuery(
      system.db.query.quest.findMany({
        where: eq(quest.project_id, currentProjectId!)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('project_id', currentProjectId)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data;
    },
    enableOfflineQuery: !!currentProjectId,
    enableCloudQuery: !!currentProjectId,
    getItemId: (item) => item.id
  });

  const { childrenOf, roots } = React.useMemo(() => {
    const items = rawQuests;

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
    setIsCreateOpen(true);
  }, []);

  const { mutateAsync: createQuest, isPending: isCreatingQuest } = useMutation({
    mutationFn: async (values: FormData) => {
      if (!currentProjectId || !currentUser?.id) return;
      await system.db
        .insert(resolveTable('quest', { localOverride: true }))
        .values({
          ...values,
          project_id: currentProjectId,
          parent_id: parentForNewQuest,
          creator_id: currentUser.id,
          download_profiles: [currentUser.id]
        });
    },
    onSuccess: () => {
      form.reset();
      setIsCreateOpen(false);
      setParentForNewQuest(null);
    },
    onError: (error) => {
      console.error('Failed to create quest', error);
    }
  });

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
              <View className="flex flex-1 flex-row items-center gap-2">
                <View>
                  <Text numberOfLines={1}>{q.name}</Text>
                </View>
                {q.description && (
                  <View className="flex-1">
                    <Text
                      className="truncate text-sm text-muted-foreground"
                      numberOfLines={1}
                    >
                      {q.description}
                    </Text>
                  </View>
                )}
              </View>
              {!!q.parent_id && (
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
                  <Icon as={Share2Icon} />
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
    <Form {...form}>
      <Drawer
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        dismissible={!isCreatingQuest}
      >
        <View className="flex-1 p-4">
          <View className="flex flex-row items-center gap-2">
            <Text variant="h4" className="mb-4">
              {t('projectDirectory')}
            </Text>
          </View>
          <View className="flex flex-col gap-2">
            {roots.length === 0 ? (
              <View>
                <Text className="text-center text-muted-foreground">
                  {t('noQuestsFound')}
                </Text>
              </View>
            ) : (
              <ScrollView className="gap-1">{renderTree(roots, 0)}</ScrollView>
            )}
            <Button
              onPress={() => openCreateForParent(null)}
              variant="outline"
              size="sm"
            >
              <Text>{t('createObject')}</Text>
            </Button>
          </View>
        </View>

        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('newQuest')}</DrawerTitle>
          </DrawerHeader>
          <View className="flex flex-col gap-4 p-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...transformInputProps(field)}
                      placeholder={t('questName')}
                      size="sm"
                      prefix={FolderPenIcon}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...transformInputProps(field)}
                      placeholder={t('description')}
                      size="sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </View>
          <DrawerFooter>
            <FormSubmit
              onPress={form.handleSubmit((data) => createQuest(data))}
            >
              <Text>{t('createObject')}</Text>
            </FormSubmit>
            <DrawerClose>
              <Text>{t('cancel')}</Text>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Form>
  );
}
