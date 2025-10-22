import { DownloadConfirmationModal } from '@/components/DownloadConfirmationModal';
import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import { QuestDownloadDiscoveryDrawer } from '@/components/QuestDownloadDiscoveryDrawer';
import { Button, buttonVariants } from '@/components/ui/button';
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
import {
  SpeedDial,
  SpeedDialItem,
  SpeedDialItems,
  SpeedDialTrigger
} from '@/components/ui/speed-dial';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useHasUserReported } from '@/hooks/db/useReports';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import {
  useBibleBookCreation,
  useBibleBooks
} from '@/hooks/useBibleBookCreation';
import { useLocalization } from '@/hooks/useLocalization';
import { useQuestDownloadDiscovery } from '@/hooks/useQuestDownloadDiscovery';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useLocalStore } from '@/store/localStore';
import { bulkDownloadQuest } from '@/utils/bulkDownload';
import type { WithSource } from '@/utils/dbUtils';
import { resolveTable } from '@/utils/dbUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { LegendList } from '@legendapp/list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq, or } from 'drizzle-orm';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChurchIcon,
  FlagIcon,
  FolderPenIcon,
  InfoIcon,
  LockIcon,
  SettingsIcon,
  UsersIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, View } from 'react-native';
import z from 'zod';
import { BibleBookList } from './BibleBookList';
import { BibleChapterList } from './BibleChapterList';
import { QuestTreeRow } from './QuestTreeRow';
import { useHybridInfiniteData } from './useHybridData';

export default function ProjectDirectoryView() {
  const { currentProjectId, currentProjectName, currentProjectTemplate } =
    useCurrentNavigation();
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  const queryClient = useQueryClient();

  // Fallback: If template is not in navigation state, fetch project
  // This handles cases like direct navigation or refresh
  const { project, isProjectLoading } = useProjectById(currentProjectId);

  // Use template from navigation state, or fall back to fetched project
  const template =
    currentProjectTemplate !== undefined
      ? currentProjectTemplate
      : project?.template;
  const projectName = currentProjectName || project?.name;
  const isPrivateProject = project?.private ?? false;

  // Bible navigation state
  const [selectedBook, setSelectedBook] = React.useState<string | null>(null);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [showPrivateAccessModal, setShowPrivateAccessModal] = useState(false);
  const { findOrCreateBook } = useBibleBookCreation();

  // Discovery drawer state for quest downloads
  const [questIdToDownload, setQuestIdToDownload] = React.useState<
    string | null
  >(null);
  const [showDiscoveryDrawer, setShowDiscoveryDrawer] = React.useState(false);
  const [showConfirmationModal, setShowConfirmationModal] =
    React.useState(false);

  // Discovery hook
  const discoveryState = useQuestDownloadDiscovery(questIdToDownload || '');

  // Track if we've started discovery for this quest ID to prevent loops
  const startedDiscoveryRef = React.useRef<string | null>(null);

  // Auto-start discovery when drawer opens with a quest ID
  React.useEffect(() => {
    if (
      showDiscoveryDrawer &&
      questIdToDownload &&
      !discoveryState.isDiscovering &&
      startedDiscoveryRef.current !== questIdToDownload
    ) {
      console.log(
        '📥 [Download] Auto-starting discovery for quest:',
        questIdToDownload
      );
      startedDiscoveryRef.current = questIdToDownload;
      discoveryState.startDiscovery();
    }

    // Reset ref when drawer closes
    if (!showDiscoveryDrawer) {
      startedDiscoveryRef.current = null;
    }
  }, [showDiscoveryDrawer, questIdToDownload, discoveryState.isDiscovering]);

  // Bulk download mutation
  const bulkDownloadMutation = useMutation({
    mutationFn: async () => {
      if (
        !currentUser?.id ||
        discoveryState.discoveredIds.questIds.length === 0
      ) {
        throw new Error('Missing user or discovered IDs');
      }

      console.log(
        '📥 [Bulk Download] Starting bulk download with IDs:',
        discoveryState.discoveredIds
      );

      const data = await bulkDownloadQuest(
        discoveryState.discoveredIds,
        currentUser.id
      );

      console.log('📥 [Bulk Download] Success:', data);
      return data;
    },
    onSuccess: async () => {
      console.log('📥 [Bulk Download] Invalidating queries');
      await queryClient.invalidateQueries({
        queryKey: ['download-status']
      });
      await queryClient.invalidateQueries({
        queryKey: ['quest-download-status']
      });
      // Invalidate the quests query to refresh the download status
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'for-project', currentProjectId]
      });
    }
  });

  type Quest = typeof quest.$inferSelect;

  const formSchema = z.object({
    name: z.string(t('nameRequired')).nonempty(t('nameRequired')).trim(),
    description: z.string().max(196).trim().optional()
  });
  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: ''
    }
  });

  const { hasAccess: canManageProject, membership } = useUserPermissions(
    currentProjectId || '',
    'project_settings_cog'
  );

  const isMember = membership === 'member' || membership === 'owner';

  const { hasReported, isLoading: isReportLoading } = useHasUserReported(
    currentProjectId!,
    'projects',
    currentUser!.id
  );

  const showHiddenContent = useLocalStore((state) => state.showHiddenContent);

  // Query existing books for Bible projects (after isMember is defined)
  const { books: existingBooks = [] } = useBibleBooks(
    template === 'bible' ? currentProjectId || '' : ''
  );

  // Build set of existing book IDs from metadata
  const existingBookIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const book of existingBooks) {
      const bookId = book.metadata?.bible?.book;
      if (bookId) {
        ids.add(bookId);
      }
    }
    return ids;
  }, [existingBooks]);

  // Handle book selection with permission check (after isMember and existingBookIds are defined)
  const handleBookSelect = React.useCallback(
    (bookId: string) => {
      const bookExists = existingBookIds.has(bookId);

      // Allow navigation if book exists (anyone can view)
      // OR if user is member (can create)
      if (bookExists || isMember) {
        setSelectedBook(bookId);

        // Find/create book quest in background if user is a member
        // This ensures the book quest exists for other operations
        if (isMember && template === 'bible') {
          findOrCreateBook({
            projectId: currentProjectId!,
            bookId: bookId
          }).catch((error: unknown) => {
            console.error('Error finding/creating book quest:', error);
          });
        }
      } else {
        Alert.alert(t('error'), t('membersOnlyCreate'));
      }
    },
    [existingBookIds, isMember, template, currentProjectId, findOrCreateBook, t]
  );

  // Only fetch quests for non-Bible projects
  const shouldFetchQuests = template !== 'bible';

  // Use infinite query for paginated loading of quests
  const PAGE_SIZE = 50; // Load 50 quests at a time

  const questsInfiniteQuery = useHybridInfiniteData({
    dataType: 'quests',
    queryKeyParams: ['for-project', currentProjectId],
    pageSize: PAGE_SIZE,
    offlineQueryFn: async ({ pageParam, pageSize }) => {
      const offset = pageParam * pageSize;
      const results = await system.db.query.quest.findMany({
        columns: {
          id: true,
          name: true,
          description: true,
          parent_id: true,
          source: true,
          visible: true
        },
        where: and(
          eq(quest.project_id, currentProjectId!),
          or(
            !showHiddenContent ? eq(quest.visible, true) : undefined,
            eq(quest.creator_id, currentUser!.id)
          )
        ),
        limit: pageSize,
        offset: offset
      });
      return results;
    },
    cloudQueryFn: async ({ pageParam, pageSize }) => {
      const offset = pageParam * pageSize;
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('id, name, description, parent_id, visible')
        .eq('project_id', currentProjectId)
        .range(offset, offset + pageSize - 1)
        .overrideTypes<
          { id: string; name: string; description: string; parent_id: string }[]
        >();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: project?.source !== 'local',
    offlineQueryOptions: {
      enabled: !!currentProjectId && shouldFetchQuests
    }
  });

  // Flatten all pages into single array for tree building
  const rawQuests = React.useMemo(() => {
    return questsInfiniteQuery.data.pages.flatMap((page) => page.data);
  }, [questsInfiniteQuery.data.pages]);

  const isLoading = questsInfiniteQuery.isLoading;

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

  const openCreateForParent = React.useCallback(
    (parentId: string | null) => {
      if (!isMember) {
        Alert.alert(t('error'), t('membersOnlyCreate'));
        return;
      }
      setParentForNewQuest(parentId);
      setIsCreateOpen(true);
    },
    [isMember, t]
  );

  // Handle download click - start discovery
  const handleDownloadClick = (questId: string) => {
    console.log('📥 [Download] Opening discovery drawer for quest:', questId);
    setQuestIdToDownload(questId);
    setShowDiscoveryDrawer(true);
    // Discovery will auto-start via useEffect
  };

  // Handle discovery completion - show confirmation
  const handleDiscoveryContinue = () => {
    console.log('📥 [Download] Discovery complete, showing confirmation');
    setShowDiscoveryDrawer(false);
    setShowConfirmationModal(true);
  };

  // Handle confirmation - execute bulk download
  const handleConfirmDownload = async () => {
    console.log('📥 [Download] User confirmed, executing bulk download');
    setShowConfirmationModal(false);
    await bulkDownloadMutation.mutateAsync();
    setQuestIdToDownload(null);
  };

  // Handle cancellation
  const handleCancelDiscovery = () => {
    console.log('📥 [Download] User cancelled discovery');
    discoveryState.cancel();
    setShowDiscoveryDrawer(false);
    setQuestIdToDownload(null);
  };

  const handleCancelConfirmation = () => {
    console.log('📥 [Download] User cancelled confirmation');
    setShowConfirmationModal(false);
    setQuestIdToDownload(null);
  };

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
            canCreateNew={isMember}
            onToggleExpand={() => toggleExpanded(id)}
            onAddChild={(parentId) => openCreateForParent(parentId)}
            onDownloadClick={handleDownloadClick}
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
      openCreateForParent,
      handleDownloadClick
    ]
  );

  // Show loading skeleton for non-Bible projects
  if (isLoading || isProjectLoading) {
    return <ProjectListSkeleton />;
  }

  // Render content based on project type
  const renderContent = () => {
    // Bible project routing
    if (template === 'bible') {
      // Show book list if no book selected
      if (!selectedBook) {
        return (
          <View className="align-start flex-1">
            <View className="flex-row items-center justify-start gap-3 p-4">
              <View className="flex flex-row items-center gap-1">
                <Icon as={ChurchIcon} />
                <Icon as={BookOpenIcon} />
              </View>
              <Text variant="h4">{projectName}</Text>
            </View>
            <BibleBookList
              projectId={currentProjectId!}
              onBookSelect={handleBookSelect}
              existingBookIds={existingBookIds}
              canCreateNew={isMember}
            />
          </View>
        );
      }

      // Show chapter list
      return (
        <View className="flex flex-1 flex-col items-start justify-start gap-2 px-4 pb-10">
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              setSelectedBook(null);
            }}
          >
            <Icon as={ArrowLeftIcon} />
            <Text>Back</Text>
          </Button>
          <View className="w-full flex-1">
            <BibleChapterList
              projectId={currentProjectId!}
              bookId={selectedBook}
            />
          </View>
        </View>
      );
    }

    // Default unstructured project view
    return (
      <View className="flex-1 flex-col gap-4 p-4">
        <Text variant="h4">{t('projectDirectory')}</Text>
        <View className="pb-safe flex flex-1 flex-col gap-2">
          {roots.length === 0 && !isLoading ? (
            <View>
              <Text className="text-center text-muted-foreground">
                {t('noQuestsFound')}
              </Text>
            </View>
          ) : (
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
                      onAddChild={(parentId) => openCreateForParent(parentId)}
                      onDownloadClick={handleDownloadClick}
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
          )}
          <Button
            onPress={() => openCreateForParent(null)}
            variant="outline"
            size="sm"
            disabled={!isMember}
          >
            <Text>{t('createObject')}</Text>
          </Button>
        </View>
      </View>
    );
  };

  return (
    <>
      {template === 'bible' ? (
        // Bible project - no Form/Drawer needed
        <View className="flex-1">{renderContent()}</View>
      ) : (
        // Non-Bible project - needs Form/Drawer for quest creation
        <Form {...form}>
          <Drawer
            open={isCreateOpen}
            onOpenChange={setIsCreateOpen}
            dismissible={!isCreatingQuest}
          >
            {renderContent()}

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
                          drawerInput
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
                          drawerInput
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
      )}

      {/* Shared SpeedDial for all project types */}
      <View style={{ bottom: 24, right: 24 }} className="absolute">
        <SpeedDial>
          <SpeedDialItems>
            {!isMember && isPrivateProject && (
              <SpeedDialItem
                icon={LockIcon}
                variant="outline"
                onPress={() => setShowPrivateAccessModal(true)}
              />
            )}
            {canManageProject ? (
              <SpeedDialItem
                icon={SettingsIcon}
                variant="outline"
                onPress={() => setShowSettingsModal(true)}
              />
            ) : !hasReported && !isReportLoading ? (
              <SpeedDialItem
                icon={FlagIcon}
                variant="outline"
                onPress={() => setShowReportModal(true)}
              />
            ) : null}
            {project?.source !== 'local' && (isMember || !isPrivateProject) && (
              <SpeedDialItem
                icon={UsersIcon}
                variant="outline"
                onPress={() => setShowMembershipModal(true)}
              />
            )}
            <SpeedDialItem
              icon={InfoIcon}
              variant="outline"
              onPress={() => setShowProjectDetails(true)}
            />
          </SpeedDialItems>
          <SpeedDialTrigger />
        </SpeedDial>
      </View>

      {/* Shared Modals */}
      <ProjectMembershipModal
        isVisible={showMembershipModal}
        onClose={() => setShowMembershipModal(false)}
        projectId={currentProjectId || ''}
      />

      {showProjectDetails && project && (
        <ModalDetails
          isVisible={showProjectDetails}
          content={project}
          contentType="project"
          onClose={() => setShowProjectDetails(false)}
        />
      )}

      {canManageProject ? (
        <ProjectSettingsModal
          isVisible={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          projectId={currentProjectId || ''}
        />
      ) : (
        <ReportModal
          isVisible={showReportModal}
          onClose={() => setShowReportModal(false)}
          recordId={currentProjectId!}
          creatorId={project?.creator_id ?? undefined}
          recordTable="projects"
          hasAlreadyReported={hasReported}
          onReportSubmitted={() => null}
        />
      )}

      <PrivateAccessGate
        projectId={currentProjectId || ''}
        projectName={projectName || ''}
        isPrivate={isPrivateProject}
        action="contribute"
        modal={true}
        isVisible={showPrivateAccessModal}
        onClose={() => setShowPrivateAccessModal(false)}
      />

      {/* Discovery Drawer */}
      <QuestDownloadDiscoveryDrawer
        isOpen={showDiscoveryDrawer}
        onOpenChange={(open) => {
          if (!open) handleCancelDiscovery();
        }}
        onContinue={handleDiscoveryContinue}
        discoveryState={discoveryState}
      />

      {/* Confirmation Modal */}
      <DownloadConfirmationModal
        visible={showConfirmationModal}
        onConfirm={handleConfirmDownload}
        onCancel={handleCancelConfirmation}
        downloadType="quest"
        discoveredCounts={{
          Quests: discoveryState.progressSharedValues.quest.value.count,
          Projects: discoveryState.progressSharedValues.project.value.count,
          'Quest-Asset Links':
            discoveryState.progressSharedValues.questAssetLinks.value.count,
          Assets: discoveryState.progressSharedValues.assets.value.count,
          'Asset Content Links':
            discoveryState.progressSharedValues.assetContentLinks.value.count,
          Votes: discoveryState.progressSharedValues.votes.value.count,
          'Quest Tags':
            discoveryState.progressSharedValues.questTagLinks.value.count,
          'Asset Tags':
            discoveryState.progressSharedValues.assetTagLinks.value.count,
          Tags: discoveryState.progressSharedValues.tags.value.count,
          Languages: discoveryState.progressSharedValues.languages.value.count
        }}
      />
    </>
  );
}
