import { DownloadConfirmationModal } from '@/components/DownloadConfirmationModal';
import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import { QuestDownloadDiscoveryDrawer } from '@/components/QuestDownloadDiscoveryDrawer';
import { Button } from '@/components/ui/button';
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
import { useCloudLoading } from '@/contexts/CloudLoadingContext';
import type { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useHasUserReported } from '@/hooks/db/useReports';
import {
  useAppNavigation,
  useCurrentNavigation
} from '@/hooks/useAppNavigation';
import {
  useBibleBookCreation,
  useBibleBooks
} from '@/hooks/useBibleBookCreation';
import { useLocalization } from '@/hooks/useLocalization';
import { useQuestDownloadDiscovery } from '@/hooks/useQuestDownloadDiscovery';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useLocalStore } from '@/store/localStore';
import { bulkDownloadQuest } from '@/utils/bulkDownload';
import { resolveTable } from '@/utils/dbUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChurchIcon,
  FlagIcon,
  FolderPenIcon,
  InfoIcon,
  LockIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, View } from 'react-native';
import z from 'zod';
import { BibleBookList } from './BibleBookList';
import { BibleChapterList } from './BibleChapterList';
import { QuestListView } from './QuestListView';

export default function ProjectDirectoryView() {
  const {
    currentProjectId,
    currentProjectName,
    currentProjectTemplate,
    currentBookId,
    currentProjectData
  } = useCurrentNavigation();
  const { navigate, goBack } = useAppNavigation();
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  const queryClient = useQueryClient();
  const { setCloudLoading } = useCloudLoading();

  // Track cloud loading states from child components
  const [questListCloudLoading, setQuestListCloudLoading] =
    React.useState(false);
  const [chapterListCloudLoading, setChapterListCloudLoading] =
    React.useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = React.useState('');

  // Use passed project data if available (instant!), otherwise query
  // Query runs in background to get updates even if data was passed
  const { project: queriedProject, isCloudLoading: projectCloudLoading } =
    useProjectById(currentProjectId);

  // Prefer passed data for instant rendering, fallback to queried
  const project =
    (currentProjectData as typeof queriedProject) || queriedProject;

  // Use template from navigation state, or fall back to fetched project
  const template =
    currentProjectTemplate !== undefined
      ? currentProjectTemplate
      : project?.template;
  const projectName = currentProjectName || project?.name;
  const isPrivateProject = project?.private ?? false;

  // Modal states
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
  }, [showDiscoveryDrawer, questIdToDownload, discoveryState]);

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
    onSuccess: () => {
      console.log('📥 [Bulk Download] Optimistically updating cache');

      // Optimistically update the cache for downloaded quests
      const downloadedQuestIds = new Set(discoveryState.discoveredIds.questIds);

      const updateQuestCache = (oldData: unknown) => {
        if (!oldData || !currentUser?.id) return oldData;

        // Handle infinite query structure
        const data = oldData as {
          pages: {
            data: {
              id: string;
              download_profiles?: string[] | null;
              source?: string;
              [key: string]: unknown;
            }[];
            nextCursor?: number;
            hasMore: boolean;
          }[];
          pageParams: number[];
        };

        // Update each page
        const updatedPages = data.pages.map((page) => ({
          ...page,
          data: page.data.map((quest) => {
            // If this quest was downloaded, update its download_profiles and source
            if (downloadedQuestIds.has(quest.id)) {
              const currentProfiles = quest.download_profiles || [];
              const updatedProfiles = currentProfiles.includes(currentUser.id)
                ? currentProfiles
                : [...currentProfiles, currentUser.id];

              console.log(
                `📥 [Cache Update] Updated quest ${quest.id.slice(0, 8)}...`
              );

              return {
                ...quest,
                download_profiles: updatedProfiles,
                source: 'synced' // Mark as synced since it's now downloaded
              };
            }
            return quest;
          })
        }));

        return {
          ...data,
          pages: updatedPages
        };
      };

      // Update offline queries (handles all search query variations)
      queryClient.setQueriesData(
        {
          queryKey: ['quests', 'offline', 'for-project', currentProjectId],
          exact: false
        },
        updateQuestCache
      );

      // Update cloud queries (handles all search query variations)
      queryClient.setQueriesData(
        {
          queryKey: ['quests', 'cloud', 'for-project', currentProjectId],
          exact: false
        },
        updateQuestCache
      );

      console.log(
        '📥 [Bulk Download] Cache updated, PowerSync will sync in background'
      );
    }
  });

  type _Quest = typeof quest.$inferSelect;

  const formSchema = z.object({
    name: z.string(t('nameRequired')).nonempty(t('nameRequired')).trim(),
    description: z.string().max(196).trim().optional()
  });
  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    defaultValues: {
      name: '',
      description: ''
    },
    resolver: zodResolver(formSchema),
    mode: 'onChange'
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

  const _showHiddenContent = useLocalStore((state) => state.showHiddenContent);

  // Query existing books for Bible projects (after isMember is defined)
  const { books: existingBooks = [], isCloudLoading: booksCloudLoading } =
    useBibleBooks(template === 'bible' ? currentProjectId || '' : '');

  // Aggregate all cloud loading states
  const isCloudLoading =
    projectCloudLoading ||
    questListCloudLoading ||
    chapterListCloudLoading ||
    booksCloudLoading;

  // Update global cloud loading state
  React.useEffect(() => {
    setCloudLoading(isCloudLoading);
  }, [isCloudLoading, setCloudLoading]);

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
        // Navigate to quests view with bookId to show chapter list
        navigate({
          view: 'quests',
          projectId: currentProjectId,
          projectName: currentProjectName,
          projectTemplate: currentProjectTemplate,
          bookId
        });

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
    [
      existingBookIds,
      isMember,
      navigate,
      currentProjectId,
      currentProjectName,
      currentProjectTemplate,
      template,
      findOrCreateBook,
      t
    ]
  );

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [parentForNewQuest, setParentForNewQuest] = React.useState<
    string | null
  >(null);

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

  // Reset form when drawer opens
  React.useEffect(() => {
    if (isCreateOpen) {
      form.reset({ name: '', description: '' });
    }
  }, [isCreateOpen, form]);

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
    onSuccess: async () => {
      form.reset();
      setIsCreateOpen(false);
      setParentForNewQuest(null);
      // Invalidate quest queries to refresh the list
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'for-project', currentProjectId]
      });
    },
    onError: (error) => {
      console.error('Failed to create quest', error);
    }
  });

  // Don't block on project loading - we can render Bible structure immediately
  // Project metadata will load in background and update when ready

  // Render content based on project type
  const renderContent = () => {
    // Bible project routing
    if (template === 'bible') {
      // Show book list if no book selected
      if (!currentBookId) {
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
          <Button variant="ghost" size="sm" onPress={goBack}>
            <Icon as={ArrowLeftIcon} />
            <Text>Back</Text>
          </Button>
          <View className="w-full flex-1">
            <BibleChapterList
              projectId={currentProjectId!}
              bookId={currentBookId}
              onCloudLoadingChange={setChapterListCloudLoading}
            />
          </View>
        </View>
      );
    }

    // Default unstructured project view
    return (
      <View className="flex-1 flex-col gap-4 p-4">
        <View className="flex flex-col gap-4">
          <Text variant="h4">{t('projectDirectory')}</Text>

          {/* Search Input */}
          <Input
            className="w-full"
            placeholder={t('searchQuests')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            prefix={SearchIcon}
            prefixStyling={false}
            size="sm"
          />
        </View>

        <View className="pb-safe flex flex-1 flex-col gap-2">
          {/* Quest List - Separated component to prevent search input re-renders */}
          <QuestListView
            projectId={currentProjectId!}
            searchQuery={searchQuery}
            projectSource={project?.source || 'local'}
            isMember={isMember}
            onAddChild={openCreateForParent}
            onDownloadClick={handleDownloadClick}
            onCloudLoadingChange={setQuestListCloudLoading}
          />

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
        <Drawer
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          dismissible={!isCreatingQuest}
        >
          {renderContent()}

          <DrawerContent className="pb-safe">
            <Form {...form}>
              <DrawerHeader>
                <DrawerTitle>{t('newQuest')}</DrawerTitle>
              </DrawerHeader>
              <View className="flex-1 flex-col gap-4 p-4">
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
                <DrawerClose disabled={isCreatingQuest}>
                  <Text>{t('cancel')}</Text>
                </DrawerClose>
              </DrawerFooter>
            </Form>
          </DrawerContent>
        </Drawer>
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
