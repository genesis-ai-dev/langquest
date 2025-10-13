import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useBibleBookCreation } from '@/hooks/useBibleBookCreation';
import { useLocalization } from '@/hooks/useLocalization';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import { FolderPenIcon } from 'lucide-react-native';
import React from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import z from 'zod';
import { BibleBookList } from './BibleBookList';
import { BibleChapterList } from './BibleChapterList';
import { QuestTreeRow } from './QuestTreeRow';
import { useHybridData } from './useHybridData';

export default function ProjectDirectoryView() {
  const { currentProjectId, currentProjectName, currentProjectTemplate } =
    useCurrentNavigation();
  const { currentUser } = useAuth();
  const { t } = useLocalization();

  // Fallback: If template is not in navigation state, fetch project
  // This handles cases like direct navigation or refresh
  const { project, isProjectLoading } = useProjectById(
    currentProjectTemplate === undefined ? currentProjectId : null
  );

  // Use template from navigation state, or fall back to fetched project
  const template =
    currentProjectTemplate !== undefined
      ? currentProjectTemplate
      : project?.template;
  const projectName = currentProjectName || project?.name;

  // Bible navigation state
  const [selectedBook, setSelectedBook] = React.useState<string | null>(null);
  const [bookQuestId, setBookQuestId] = React.useState<string | null>(null);
  const { findOrCreateBook } = useBibleBookCreation();

  // Find/create book quest when a book is selected
  React.useEffect(() => {
    if (selectedBook && !bookQuestId && template === 'bible') {
      findOrCreateBook({
        projectId: currentProjectId!,
        bookId: selectedBook
      })
        .then((bookQuest) => {
          setBookQuestId(bookQuest.id);
        })
        .catch((error) => {
          console.error('Error finding/creating book quest:', error);
        });
    }
  }, [selectedBook, bookQuestId, currentProjectId, findOrCreateBook, template]);

  type Quest = typeof quest.$inferSelect;

  const formSchema = z.object({
    name: z.string(t('nameRequired')).nonempty(t('nameRequired')).trim(),
    description: z.string().max(196).trim().optional()
  });
  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema)
  });

  // Only fetch quests for non-Bible projects
  const shouldFetchQuests = template !== 'bible';

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
    enableOfflineQuery: !!currentProjectId && shouldFetchQuests,
    enableCloudQuery: !!currentProjectId && shouldFetchQuests,
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
          <QuestTreeRow
            key={id}
            quest={q}
            depth={depth}
            hasChildren={hasChildren}
            isOpen={isOpen}
            onToggleExpand={() => toggleExpanded(id)}
            onAddChild={(parentId) => openCreateForParent(parentId)}
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
    [childrenOf, expanded, toggleExpanded, openCreateForParent]
  );

  // Bible project routing - instant render with no loading state needed
  if (template === 'bible') {
    // Show book list if no book selected
    if (!selectedBook) {
      return (
        <View className="flex-1">
          <View className="flex-row items-center justify-between p-4">
            <Text variant="h4">📖 {projectName}</Text>
          </View>
          <BibleBookList
            projectId={currentProjectId!}
            onBookSelect={setSelectedBook}
          />
        </View>
      );
    }

    // Show chapter list if book selected
    if (!bookQuestId) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4">Loading book...</Text>
        </View>
      );
    }

    return (
      <View className="flex-1">
        <View className="flex-row items-center gap-2 p-4">
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              setSelectedBook(null);
              setBookQuestId(null);
            }}
          >
            <Text>← Back</Text>
          </Button>
        </View>
        <BibleChapterList
          projectId={currentProjectId!}
          bookId={selectedBook}
          bookQuestId={bookQuestId}
        />
      </View>
    );
  }

  // Show loading skeleton for non-Bible projects
  if (isLoading || isProjectLoading) {
    return <ProjectListSkeleton />;
  }

  // Default unstructured project view
  return (
    <Form {...form}>
      <Drawer
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        dismissible={!isCreatingQuest}
      >
        <View className="flex-1 flex-col gap-4 p-4">
          <Text variant="h4">{t('projectDirectory')}</Text>
          <View className="pb-safe flex flex-1 flex-col gap-2">
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

        <DrawerContent className="pb-safe">
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
            <DrawerClose className={buttonVariants({ variant: 'outline' })}>
              <Text>{t('cancel')}</Text>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Form>
  );
}
