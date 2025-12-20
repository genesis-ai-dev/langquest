import { DownloadConfirmationModal } from '@/components/DownloadConfirmationModal';
import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import { QuestDownloadDiscoveryDrawer } from '@/components/QuestDownloadDiscoveryDrawer';
import { QuestOffloadVerificationDrawer } from '@/components/QuestOffloadVerificationDrawer';
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
import type { Quest } from '@/hooks/db/useQuests';
import { useQuestById } from '@/hooks/db/useQuests';
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
import { useQuestOffloadVerification } from '@/hooks/useQuestOffloadVerification';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { syncCallbackService } from '@/services/syncCallbackService';
import { useLocalStore } from '@/store/localStore';
import { bulkDownloadQuest } from '@/utils/bulkDownload';
import { resolveTable } from '@/utils/dbUtils';
import { offloadQuest } from '@/utils/questOffloadUtils';
import { getThemeColor } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
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
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
  UserPlusIcon,
  UsersIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const { currentUser, isAuthenticated } = useAuth();
  const { t } = useLocalization();
  const queryClient = useQueryClient();
  const { setCloudLoading } = useCloudLoading();
  const insets = useSafeAreaInsets();

  // Track cloud loading states from child components
  const [questListCloudLoading, setQuestListCloudLoading] =
    React.useState(false);
  const [chapterListCloudLoading, setChapterListCloudLoading] =
    React.useState(false);
  const [questListFetching, setQuestListFetching] = React.useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Animation for refresh button
  const spinValue = useSharedValue(0);

  React.useEffect(() => {
    if (isRefreshing) {
      spinValue.value = withRepeat(
        withTiming(1, { duration: 1000, easing: Easing.linear }),
        -1
      );
    } else {
      cancelAnimation(spinValue);
      spinValue.value = 0;
    }
  }, [isRefreshing, spinValue]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinValue.value * 360}deg` }]
  }));

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

  // Track quest IDs that are currently downloading (for optimistic UI updates)
  const [downloadingQuestIds, setDownloadingQuestIds] = React.useState<
    Set<string>
  >(new Set());

  // Offload drawer state for quest undownloads
  const [showOffloadDrawer, setShowOffloadDrawer] = React.useState(false);
  const [isOffloading, setIsOffloading] = React.useState(false);

  // Discovery hook
  const discoveryState = useQuestDownloadDiscovery(questIdToDownload || '');

  // Verification hook for offload
  const verificationState = useQuestOffloadVerification(
    questIdToDownload || ''
  );

  // Get quest data to display name in drawer
  const { quest: questToOffload } = useQuestById(
    questIdToDownload || undefined
  );

  // Track if we've started discovery for this quest ID to prevent loops
  const startedDiscoveryRef = React.useRef<string | null>(null);
  // Track if we've started verification for this quest ID to prevent loops
  const startedVerificationRef = React.useRef<string | null>(null);

  // Auto-start discovery when drawer opens with a quest ID
  React.useEffect(() => {
    if (
      showDiscoveryDrawer &&
      questIdToDownload &&
      !discoveryState.isDiscovering &&
      startedDiscoveryRef.current !== questIdToDownload
    ) {
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

      const data = await bulkDownloadQuest(
        discoveryState.discoveredIds,
        currentUser.id
      );

      console.log('📥 [Bulk Download] Success:', data);
      return data;
    },
    onMutate: () => {
      console.log(
        '📥 [Bulk Download] Optimistically updating cache (BEFORE mutation)'
      );

      // Optimistically update the cache for downloaded quests IMMEDIATELY
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
        '📥 [Bulk Download] Cache updated - UI should show downloaded state immediately'
      );
    },
    onSuccess: () => {
      console.log('📥 [Bulk Download] Success - registering sync callback...');

      // Register callback to invalidate queries after PowerSync sync completes
      if (questIdToDownload) {
        // Get all quest IDs to clear from downloading state
        const questIdsToClear = discoveryState.discoveredIds.questIds;

        syncCallbackService.registerCallback(questIdToDownload, async () => {
          console.log(
            '📥 [Bulk Download] Sync completed - invalidating queries'
          );

          // Clear downloading state - sync is complete, UI should show real data now
          setDownloadingQuestIds((prev) => {
            const next = new Set(prev);
            questIdsToClear.forEach((id) => next.delete(id));
            return next;
          });

          // Invalidate all quest queries for this project
          await queryClient.invalidateQueries({
            queryKey: ['quests', 'infinite', 'for-project', currentProjectId]
          });

          await queryClient.invalidateQueries({
            queryKey: ['quests', 'offline', 'for-project', currentProjectId]
          });

          await queryClient.invalidateQueries({
            queryKey: ['quests', 'cloud', 'for-project', currentProjectId]
          });

          // Invalidate assets queries to refresh assets list if user is viewing a quest
          await queryClient.invalidateQueries({
            queryKey: ['assets']
          });

          console.log(
            '📥 [Bulk Download] Queries invalidated - UI will refresh'
          );
        });
      }
    },
    onError: (error) => {
      console.error('📥 [Bulk Download] Failed:', error);
      // Rollback optimistic cache updates if mutation fails
      // Query client will automatically rollback if we return context
    }
  });

  type _Quest = typeof quest.$inferSelect;

  const formSchema = z.object({
    name: z.string(t('nameRequired')).nonempty(t('nameRequired')).trim(),
    description: z.string().max(196).trim().optional()
  });
  type FormData = z.infer<typeof formSchema>;

  const defaultValues = {
    name: '',
    description: ''
  };

  const form = useForm<FormData>({
    defaultValues,
    resolver: zodResolver(formSchema)
  });

  // Check membership status separately from settings permission
  // Use 'open_project' action to get accurate membership status
  const { membership: membershipStatus, hasAccess: _canOpenProject } =
    useUserPermissions(
      currentProjectId || '',
      'open_project',
      isPrivateProject
    );

  // Check if user can manage project settings (separate from membership)
  const { hasAccess: canManageProject } = useUserPermissions(
    currentProjectId || '',
    'project_settings_cog',
    isPrivateProject
  );

  const isMember =
    membershipStatus === 'member' || membershipStatus === 'owner';

  // Only check for reports if user is logged in
  const { hasReported, isLoading: isReportLoading } = useHasUserReported(
    currentProjectId!,
    'projects',
    currentUser?.id || ''
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
        RNAlert.alert(t('error'), t('membersOnlyCreate'));
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
        RNAlert.alert(t('error'), t('membersOnlyCreate'));
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

  // Handle download click - only for downloading (not offloading)
  const handleDownloadClick = (questId: string) => {
    // Anonymous users cannot download - this should not be called, but guard anyway
    if (!currentUser) {
      console.log(
        '[ProjectDirectoryView] Download requested but user is anonymous'
      );
      return;
    }

    setQuestIdToDownload(questId);
    // Quest not downloaded, start download discovery
    console.log('📥 [Download] Opening discovery drawer for quest:', questId);
    setShowDiscoveryDrawer(true);
    // Discovery will auto-start via useEffect
  };

  // Handle offload click - opens the offload verification drawer
  const handleOffloadClick = (questId: string) => {
    setQuestIdToDownload(questId);
    console.log('🗑️ [Offload] Opening verification drawer for quest:', questId);
    setShowOffloadDrawer(true);
    // Verification will auto-start via useEffect
  };

  // Handle discovery completion - show confirmation
  const handleDiscoveryContinue = () => {
    setShowDiscoveryDrawer(false);
    setShowConfirmationModal(true);
  };

  // Handle confirmation - execute bulk download
  const handleConfirmDownload = async () => {
    setShowConfirmationModal(false);

    // Track all discovered quest IDs as downloading for optimistic UI
    // Set this BEFORE mutation so components can show loading state
    const questIdsToTrack = new Set(discoveryState.discoveredIds.questIds);
    setDownloadingQuestIds((prev) => new Set([...prev, ...questIdsToTrack]));

    try {
      // Mutation's onMutate will optimistically update cache, triggering UI updates
      await bulkDownloadMutation.mutateAsync();
      // Don't clear questIdToDownload yet - wait for sync callback
    } catch (error) {
      // On error, rollback cache and clear downloading state
      // The mutation's onError will handle cache rollback
      setDownloadingQuestIds((prev) => {
        const next = new Set(prev);
        questIdsToTrack.forEach((id) => next.delete(id));
        return next;
      });
      setQuestIdToDownload(null);
      throw error;
    }
  };

  // Handle cancellation
  const handleCancelDiscovery = () => {
    console.log('📥 [Download] User cancelled discovery');
    discoveryState.cancel();

    // Cancel sync callback if registered
    if (questIdToDownload) {
      syncCallbackService.cancelCallback(questIdToDownload);
      // Clear downloading state
      setDownloadingQuestIds((prev) => {
        const next = new Set(prev);
        next.delete(questIdToDownload);
        return next;
      });
    }

    setShowDiscoveryDrawer(false);
    setQuestIdToDownload(null);
  };

  const handleCancelConfirmation = () => {
    console.log('📥 [Download] User cancelled confirmation');

    // Cancel sync callback if registered
    if (questIdToDownload) {
      syncCallbackService.cancelCallback(questIdToDownload);

      // Clear downloading state for all discovered quest IDs
      const questIdsToClear = discoveryState.discoveredIds.questIds;
      setDownloadingQuestIds((prev) => {
        const next = new Set(prev);
        questIdsToClear.forEach((id) => next.delete(id));
        return next;
      });
    }

    setShowConfirmationModal(false);
    setQuestIdToDownload(null);
  };

  // Handle offload verification - start offload
  const handleOffloadContinue = async () => {
    console.log('🗑️ [Offload] User confirmed, executing offload');
    setShowOffloadDrawer(false);
    setIsOffloading(true);

    try {
      await offloadQuest({
        questId: questIdToDownload || '',
        verifiedIds: verificationState.verifiedIds,
        onProgress: (progress, message) => {
          console.log(`🗑️ [Offload Progress] ${progress}%: ${message}`);
        }
      });

      console.log('🗑️ [Offload] Complete - registering sync callback...');

      // Register callback to invalidate queries after PowerSync sync completes
      if (questIdToDownload) {
        syncCallbackService.registerCallback(questIdToDownload, async () => {
          console.log('🗑️ [Offload] Sync completed - invalidating queries');

          // Invalidate all quest queries for this project
          await queryClient.invalidateQueries({
            queryKey: ['quests', 'infinite', 'for-project', currentProjectId]
          });

          await queryClient.invalidateQueries({
            queryKey: ['quests', 'offline', 'for-project', currentProjectId]
          });

          await queryClient.invalidateQueries({
            queryKey: ['quests', 'cloud', 'for-project', currentProjectId]
          });

          console.log('🗑️ [Offload] Queries invalidated - UI will refresh');
        });
      }
    } catch (error) {
      console.error('🗑️ [Offload] Failed:', error);
      RNAlert.alert(t('error'), t('offloadError'));
    } finally {
      setIsOffloading(false);
      setQuestIdToDownload(null);
    }
  };

  // Handle offload cancellation
  const handleCancelOffload = () => {
    console.log('🗑️ [Offload] User cancelled verification');
    verificationState.cancel();

    // Cancel sync callback if registered
    if (questIdToDownload) {
      syncCallbackService.cancelCallback(questIdToDownload);
    }

    setShowOffloadDrawer(false);
    setQuestIdToDownload(null);
  };

  // Auto-start verification when offload drawer opens
  React.useEffect(() => {
    if (
      showOffloadDrawer &&
      questIdToDownload &&
      !verificationState.isVerifying &&
      startedVerificationRef.current !== questIdToDownload
    ) {
      console.log(
        '🗑️ [Offload] Auto-starting verification for quest:',
        questIdToDownload
      );
      startedVerificationRef.current = questIdToDownload;
      verificationState.startVerification();
    }
    // Reset ref when drawer closes or quest changes
    if (!showOffloadDrawer || !questIdToDownload) {
      startedVerificationRef.current = null;
    }
  }, [showOffloadDrawer, questIdToDownload, verificationState]);

  const { mutateAsync: createQuest, isPending: isCreatingQuest } = useMutation({
    mutationFn: async (values: FormData) => {
      if (!currentProjectId || !currentUser?.id) return;
      const [newQuest] = await system.db
        .insert(resolveTable('quest', { localOverride: true }))
        .values({
          ...values,
          project_id: currentProjectId,
          parent_id: parentForNewQuest,
          creator_id: currentUser.id,
          download_profiles: [currentUser.id]
        })
        .returning();

      if (!newQuest) {
        throw new Error('Failed to create quest');
      }

      return newQuest;
    },
    onMutate: async (values) => {
      // Optimistically update the UI immediately
      if (!currentProjectId || !currentUser?.id) return;

      const baseKey = [
        'quests',
        'infinite',
        'for-project',
        currentProjectId,
        searchQuery
      ];
      const offlineKey = [...baseKey, 'offline'];
      const cloudKey = [...baseKey, 'cloud'];

      // Cancel outgoing queries to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ['quests', 'infinite', 'for-project', currentProjectId]
      });

      // Snapshot previous values for rollback
      const previousOffline = queryClient.getQueryData(offlineKey);
      const previousCloud = queryClient.getQueryData(cloudKey);

      // Create optimistic quest data
      const optimisticQuest = {
        id: `temp-${Date.now()}`, // Temporary ID until real one is returned
        name: values.name,
        description: values.description || null,
        project_id: currentProjectId,
        parent_id: parentForNewQuest,
        creator_id: currentUser.id,
        download_profiles: [currentUser.id],
        visible: true,
        source: 'local' as const
      };

      // Optimistically update offline infinite query cache
      queryClient.setQueryData(
        offlineKey,
        (old?: { pages: { data: Quest[] }[] }) => {
          if (!old) return undefined;

          // Add optimistic quest to first page
          return {
            ...old,
            pages: old.pages.map((page: { data: Quest[] }, index: number) => {
              if (index === 0) {
                return {
                  ...page,
                  data: [...page.data, optimisticQuest]
                };
              }
              return page;
            })
          };
        }
      );

      return { previousOffline, previousCloud };
    },
    onSuccess: async (newQuest) => {
      form.reset();
      setIsCreateOpen(false);
      setParentForNewQuest(null);

      console.log(
        '✅ [Create Quest] Quest created, updating cache with real data...'
      );

      // Update cache with real quest data (replace optimistic one)
      const baseKey = [
        'quests',
        'infinite',
        'for-project',
        currentProjectId,
        searchQuery
      ];
      const offlineKey = [...baseKey, 'offline'];

      queryClient.setQueryData(
        offlineKey,
        (old?: { pages: { data: Quest[] }[] }) => {
          return {
            ...old,
            pages: old?.pages.map((page: { data: Quest[] }, index: number) => {
              if (index === 0) {
                // Replace optimistic quest(s) with real one
                const data = page.data.map((quest: Quest) =>
                  quest.id.startsWith('temp-')
                    ? { ...newQuest, source: 'local' as const }
                    : quest
                );

                // If no optimistic quest was found, add real one
                const hasOptimistic = page.data.some((q: Quest) =>
                  q.id.startsWith('temp-')
                );
                if (!hasOptimistic) {
                  data.push({ ...newQuest, source: 'local' as const });
                }

                return { ...page, data };
              }
              return page;
            })
          };
        }
      );

      console.log('📥 [Create Quest] Waiting for PowerSync to sync...');
      // Wait for PowerSync to sync, then invalidate to ensure consistency
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log('📥 [Create Quest] Invalidating all quest queries...');
      // Invalidate ALL quest queries to refresh the list (matches manual refresh button)
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'for-project', currentProjectId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'infinite', 'for-project', currentProjectId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'offline', 'for-project', currentProjectId]
      });
      await queryClient.invalidateQueries({
        queryKey: ['quests', 'cloud', 'for-project', currentProjectId]
      });

      console.log('📥 [Create Quest] Invalidating assets queries');
      // Invalidate assets queries to refresh assets list if user is viewing a quest
      await queryClient.invalidateQueries({
        queryKey: ['assets']
      });

      console.log('✅ [Create Quest] All queries invalidated');
    },
    onError: (error, values, context) => {
      console.error('Failed to create quest', error);

      // Rollback optimistic update on error
      if (context?.previousOffline) {
        const baseKey = [
          'quests',
          'infinite',
          'for-project',
          currentProjectId,
          searchQuery
        ];
        queryClient.setQueryData(
          [...baseKey, 'offline'],
          context.previousOffline
        );
      }
      if (context?.previousCloud) {
        const baseKey = [
          'quests',
          'infinite',
          'for-project',
          currentProjectId,
          searchQuery
        ];
        queryClient.setQueryData([...baseKey, 'cloud'], context.previousCloud);
      }
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
            <View className="flex-col items-center justify-between gap-3 p-4">
              <View className="flex flex-row items-center gap-3">
                <View className="flex flex-row items-center gap-1">
                  <Icon as={ChurchIcon} />
                  <Icon as={BookOpenIcon} />
                </View>
                <Text variant="h4">{projectName}</Text>
              </View>
              {isPrivateProject && !isMember && currentUser && (
                <Button
                  variant="default"
                  size="sm"
                  onPress={() => setShowPrivateAccessModal(true)}
                >
                  <Icon as={UserPlusIcon} size={16} />
                  <Icon as={LockIcon} size={16} />
                </Button>
              )}
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
          <View className="flex flex-row items-center justify-between gap-2">
            <View className="flex flex-row items-center gap-2">
              <Text variant="h4">{t('projectDirectory')}</Text>
              <Button
                variant="ghost"
                size="icon"
                disabled={isRefreshing}
                onPress={async () => {
                  setIsRefreshing(true);
                  console.log('🔄 Manually refreshing quest queries...');
                  await queryClient.invalidateQueries({
                    queryKey: ['quests', 'for-project', currentProjectId]
                  });
                  await queryClient.invalidateQueries({
                    queryKey: [
                      'quests',
                      'infinite',
                      'for-project',
                      currentProjectId
                    ]
                  });
                  await queryClient.invalidateQueries({
                    queryKey: [
                      'quests',
                      'offline',
                      'for-project',
                      currentProjectId
                    ]
                  });
                  await queryClient.invalidateQueries({
                    queryKey: [
                      'quests',
                      'cloud',
                      'for-project',
                      currentProjectId
                    ]
                  });
                  console.log('🔄 Quest queries invalidated');
                  // Stop animation after a brief delay
                  setTimeout(() => {
                    setIsRefreshing(false);
                  }, 500);
                }}
              >
                <Animated.View style={spinStyle}>
                  <Icon as={RefreshCwIcon} size={18} className="text-primary" />
                </Animated.View>
              </Button>
            </View>
            {isPrivateProject && !isMember && currentUser && (
              <Button
                variant="default"
                size="sm"
                onPress={() => setShowPrivateAccessModal(true)}
              >
                <Icon as={UserPlusIcon} size={16} />
                <Icon as={LockIcon} size={16} />
              </Button>
            )}
          </View>

          {/* Search Input */}
          <Input
            className="w-full"
            placeholder={t('searchQuests')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            prefix={SearchIcon}
            prefixStyling={false}
            size="sm"
            returnKeyType="search"
            suffix={
              questListFetching && searchQuery ? (
                <ActivityIndicator
                  size="small"
                  color={getThemeColor('primary')}
                />
              ) : undefined
            }
            suffixStyling={false}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
            onOffloadClick={handleOffloadClick}
            onCloudLoadingChange={setQuestListCloudLoading}
            onFetchingChange={setQuestListFetching}
            downloadingQuestId={questIdToDownload}
            downloadingQuestIds={downloadingQuestIds}
          />

          {/* Only show create button for authenticated users */}
          {currentUser && (
            <View
              style={{
                paddingBottom: insets.bottom,
                paddingRight: 80 // Leave space for SpeedDial on the right (24 margin + ~56 width + padding)
              }}
            >
              <Button
                onPress={() => openCreateForParent(null)}
                variant="default"
                size="sm"
                disabled={!isMember}
              >
                <Text>{t('createObject')}</Text>
              </Button>
            </View>
          )}
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
          snapPoints={[450, 700]}
        >
          {renderContent()}

          <DrawerContent className="pb-safe">
            <Form {...form}>
              <DrawerHeader>
                <DrawerTitle>{t('newQuest')}</DrawerTitle>
              </DrawerHeader>
              <View className="flex flex-col gap-4">
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
                          // drawerInput
                          type="next"
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
                          // drawerInput
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
      <View
        style={{
          bottom: insets.bottom + 24,
          right: 24
        }}
        className="absolute"
      >
        <SpeedDial>
          <SpeedDialItems>
            {/* For anonymous users, only show info button */}
            {isAuthenticated ? (
              <>
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
                {project?.source !== 'local' &&
                  (isMember || !isPrivateProject) && (
                    <SpeedDialItem
                      icon={UsersIcon}
                      variant="outline"
                      onPress={() => setShowMembershipModal(true)}
                    />
                  )}
              </>
            ) : null}
            {/* Info button always visible */}
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
          recordTable="project"
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
      {/* Offload Verification Drawer */}
      <QuestOffloadVerificationDrawer
        isOpen={showOffloadDrawer}
        onOpenChange={(open) => {
          if (!open) handleCancelOffload();
        }}
        onContinue={handleOffloadContinue}
        verificationState={verificationState}
        isOffloading={isOffloading}
        questName={questToOffload?.name}
      />
    </>
  );
}
