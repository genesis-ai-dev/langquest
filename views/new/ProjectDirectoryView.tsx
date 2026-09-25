import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
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

import { invite, profile_project_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import type { Quest } from '@/hooks/db/useQuests';
import { useHasUserReported } from '@/hooks/db/useReports';
import { invalidateCloud } from '@/hooks/hybridCache';
import {
  useBibleBookCreation,
  useBibleBooks
} from '@/hooks/useBibleBookCreation';
import {
  useFiaBookCreation,
  useFiaBookQuests
} from '@/hooks/useFiaBookCreation';
import { useFiaBooks } from '@/hooks/useFiaBooks';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { useLocalization } from '@/hooks/useLocalization';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useProjectSourceLanguoid } from '@/hooks/useProjectSourceLanguoid';
import { useQuestDownloadFlow } from '@/hooks/useQuestDownloadFlow';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useLocalStore } from '@/store/localStore';
import { resolveTable } from '@/utils/dbUtils';
import { extractFiaMetadata } from '@/utils/fiaUtils';
import { cn, getThemeColor, useThemeColor } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { zodResolver } from '@hookform/resolvers/zod';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq } from 'drizzle-orm';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  BookOpenIcon,
  ChurchIcon,
  FlagIcon,
  FolderPenIcon,
  InfoIcon,
  LockIcon,
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  XIcon
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
import { FiaBookList } from './FiaBookList';
import { QuestListView } from './QuestListView';

// Hook to determine if the invite banner should be shown for a project
// Returns shouldShowInviteBanner=true if ALL of the following are true:
// 1. Current user is the owner
// 2. No invites have been sent for this project (invite count = 0)
// 3. User is the only member (member count = 1)
// Invite Members Banner Component
function InviteMembersBanner({
  show,
  onDismiss,
  onInvite
}: {
  show: boolean;
  onDismiss: () => void;
  onInvite: () => void;
}) {
  const { t } = useLocalization();

  if (!show) return null;

  return (
    <View className="flex-row items-center justify-between gap-2 rounded-md border border-border bg-card p-3">
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <Icon as={UsersIcon} className="text-primary" size={20} />
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-medium leading-tight">
            {t('inviteMembersTitle')}
          </Text>
          <Text
            className="text-xs leading-snug text-muted-foreground"
            numberOfLines={2}
          >
            {t('inviteMembersDescription')}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-1">
        <Button
          variant="default"
          size="sm"
          className={cn('h-7 gap-1 px-3')}
          onPress={onInvite}
          testID="project-invite-banner"
        >
          <Text className="text-xs font-medium text-primary-foreground">
            {t('invite')}
          </Text>
        </Button>
        <Button variant="ghost" size="icon-sm" onPress={onDismiss}>
          <Icon as={XIcon} size={16} className="text-muted-foreground" />
        </Button>
      </View>
    </View>
  );
}

function useProjectHasNoInvites(projectId: string) {
  // Check ownership
  const { membership, isMembershipLoading } = useUserPermissions(
    projectId,
    'send_invite_section'
  );
  const isOwner = membership === 'owner';

  // Query invite count for this project (offline only - PowerSync has this data)
  const {
    data: inviteData,
    isLoading: isInviteLoading,
    isError: isInviteError
  } = useHybridQuery<{
    id: string;
  }>({
    queryKey: ['project-invite-count', projectId],
    offlineQuery: toCompilableQuery(
      system.db
        .select({ id: invite.id })
        .from(invite)
        .where(eq(invite.project_id, projectId))
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('invite')
        .select('id')
        .eq('project_id', projectId);
      if (error) throw error;
      return data ?? [];
    }
  });

  const {
    data: memberData,
    isLoading: isMemberLoading,
    isError: isMemberError
  } = useHybridQuery<{
    id: string;
  }>({
    queryKey: ['project-member-count', projectId],
    offlineQuery: toCompilableQuery(
      system.db
        .select({ id: profile_project_link.id })
        .from(profile_project_link)
        .where(
          and(
            eq(profile_project_link.project_id, projectId),
            eq(profile_project_link.active, true)
          )
        )
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('profile_project_link')
        .select('id')
        .eq('project_id', projectId)
        .eq('active', true);
      if (error) throw error;
      return data ?? [];
    }
  });

  const inviteCount = inviteData.length;
  const memberCount = memberData.length;

  // Solo owner = only 1 member and that member is the owner
  const isSoloOwner = isOwner && memberCount === 1;

  // Show banner if: solo owner and no invites sent
  const shouldShowInviteBanner = isSoloOwner && inviteCount === 0;

  return {
    shouldShowInviteBanner,
    isLoading: isMembershipLoading || isInviteLoading || isMemberLoading,
    isError: isInviteError || isMemberError,
    inviteCount,
    memberCount,
    isOwner,
    isSoloOwner
  };
}

export default function ProjectDirectoryView() {
  const { projectId, router, goToQuest } = useNavigationHelpers();
  const expoRouter = useRouter();
  const { openMembership } = useLocalSearchParams<{
    openMembership?: string;
  }>();
  const { currentUser, isAuthenticated } = useAuth();
  const { t } = useLocalization();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const primaryColor = useThemeColor('primary');

  // Track cloud loading states from child components
  const [_questListCloudLoading, setQuestListCloudLoading] =
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
  const { project: queriedProject } = useProjectById(projectId);

  const project = queriedProject;
  const template = project?.template;
  const projectName = project?.name;
  const isPrivateProject = project?.private ?? false;

  // Modal states
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [membershipModalInitialTab, setMembershipModalInitialTab] = useState<
    'members' | 'invited' | 'requests'
  >('members');

  const openMembershipModal = React.useCallback(
    (tab: 'members' | 'invited' | 'requests') => {
      setMembershipModalInitialTab(tab);
      setShowMembershipModal(true);
    },
    []
  );

  React.useEffect(() => {
    if (openMembership === 'invited') {
      openMembershipModal('invited');
      expoRouter.setParams({ openMembership: undefined });
    }
  }, [openMembership, expoRouter, openMembershipModal]);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [showPrivateAccessModal, setShowPrivateAccessModal] = useState(false);
  const { findOrCreateBook } = useBibleBookCreation();

  const questDownloadFlow = useQuestDownloadFlow(projectId || '');

  const formSchema = z.object({
    name: z.string(t('nameRequired')).nonempty(t('nameRequired')).trim(),
    description: z.string().max(1024).trim().optional()
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
    useUserPermissions(projectId || '', 'open_project', isPrivateProject);

  // Check if user can manage project settings (separate from membership)
  const { hasAccess: canManageProject } = useUserPermissions(
    projectId || '',
    'project_settings_cog',
    isPrivateProject
  );

  const isMember =
    membershipStatus === 'member' || membershipStatus === 'owner';

  // Only check for reports if user is logged in
  const { hasReported, isLoading: isReportLoading } = useHasUserReported(
    projectId!,
    'projects',
    currentUser?.id || ''
  );

  const _showHiddenContent = useLocalStore((state) => state.showHiddenContent);
  const enableFia = useLocalStore((state) => state.enableFia);
  const dismissedInviteBanners = useLocalStore(
    (state) => state.dismissedInviteBanners
  );
  const dismissInviteBanner = useLocalStore(
    (state) => state.dismissInviteBanner
  );

  // Check if banner should show: owner, no invites sent, only member
  const { shouldShowInviteBanner, isLoading: isInviteCheckLoading } =
    useProjectHasNoInvites(projectId || '');

  // Check if banner is dismissed for this project
  const isBannerDismissed = Boolean(dismissedInviteBanners[projectId || '']);

  // Show invite banner if: conditions met, not dismissed, not loading
  const showInviteBanner =
    shouldShowInviteBanner && !isBannerDismissed && !isInviteCheckLoading;

  // Query existing books for Bible projects (after isMember is defined)
  const { books: existingBooks = [] } = useBibleBooks(
    template === 'bible' ? projectId || '' : ''
  );

  // FIA: Fetch source languoid, FIA books from API, and existing book quests
  const { sourceLanguoidId, isLoading: sourceLanguoidLoading } =
    useProjectSourceLanguoid(template === 'fia' ? projectId || '' : '');
  const {
    books: fiaBooks,
    isLoading: fiaBooksLoading,
    error: fiaError,
    refetch: refetchFia
  } = useFiaBooks(template === 'fia' ? sourceLanguoidId : null);
  const fiaLoading = sourceLanguoidLoading || fiaBooksLoading;
  const { books: existingFiaBookQuests = [] } = useFiaBookQuests(
    template === 'fia' ? projectId || '' : ''
  );
  const { findOrCreateBook: findOrCreateFiaBook } = useFiaBookCreation();

  const existingFiaBookIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const bq of existingFiaBookQuests) {
      const bookId = extractFiaMetadata(bq.metadata)?.bookId;
      if (bookId) ids.add(bookId);
    }
    return ids;
  }, [existingFiaBookQuests]);

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
      const matches = existingBooks.filter(
        (book) => book.metadata?.bible?.book === bookId
      );
      const existingBook =
        matches.find((book) => book.published_at != null) ?? matches[0];

      if (existingBook) {
        goToQuest({
          id: existingBook.id,
          project_id: existingBook.project_id,
          name: existingBook.name
        });
        return;
      }

      if (!isMember) {
        RNAlert.alert(t('error'), t('membersOnlyCreate'));
        return;
      }

      if (template === 'bible') {
        findOrCreateBook({
          projectId: projectId!,
          bookId: bookId
        })
          .then((result) => {
            if (result?.id) {
              goToQuest({
                id: result.id,
                project_id: result.project_id,
                name: result.name
              });
            }
          })
          .catch((error: unknown) => {
            console.error('Error finding/creating book quest:', error);
          });
      }
    },
    [
      existingBooks,
      isMember,
      goToQuest,
      projectId,
      template,
      findOrCreateBook,
      t
    ]
  );

  // Handle FIA book selection
  const handleFiaBookSelect = React.useCallback(
    (bookId: string) => {
      const matches = existingFiaBookQuests.filter(
        (bq) => extractFiaMetadata(bq.metadata)?.bookId === bookId
      );
      const existingBook =
        matches.find((book) => book.published_at != null) ?? matches[0];

      if (existingBook) {
        goToQuest({
          id: existingBook.id,
          project_id: existingBook.project_id,
          name: existingBook.name
        });
        return;
      }

      if (!isMember) {
        RNAlert.alert(t('error'), t('membersOnlyCreate'));
        return;
      }

      const fiaBook = fiaBooks.find((b) => b.id === bookId);
      if (!fiaBook) return;

      findOrCreateFiaBook({
        projectId: projectId!,
        bookId,
        bookTitle: fiaBook.title,
        pericopeCount: fiaBook.pericopes.length
      })
        .then((result) => {
          if (result?.id) {
            goToQuest({
              id: result.id,
              project_id: result.project_id,
              name: result.name
            });
          }
        })
        .catch((error: unknown) => {
          console.error('Error finding/creating FIA book quest:', error);
        });
    },
    [
      existingFiaBookQuests,
      isMember,
      goToQuest,
      projectId,
      fiaBooks,
      findOrCreateFiaBook,
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

  const { mutateAsync: createQuest } = useMutation({
    mutationFn: async (values: FormData) => {
      if (!projectId || !currentUser?.id) return;
      const [newQuest] = await system.db
        .insert(resolveTable('quest', { localOverride: true }))
        .values({
          ...values,
          project_id: projectId,
          parent_id: parentForNewQuest,
          creator_id: currentUser.id,
          download_profiles: [currentUser.id],
          published_at: null
        })
        .returning();

      if (!newQuest) {
        throw new Error('Failed to create quest');
      }

      return newQuest;
    },
    onMutate: async (values) => {
      // Optimistically update the UI immediately
      if (!projectId || !currentUser?.id) return;

      const baseKey = [
        'quests',
        'infinite',
        'for-project',
        projectId,
        searchQuery
      ];
      const offlineKey = [...baseKey, 'offline'];
      const cloudKey = [...baseKey, 'cloud'];

      // Cancel outgoing queries to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ['quests', 'infinite', 'for-project', projectId]
      });

      // Snapshot previous values for rollback
      const previousOffline = queryClient.getQueryData(offlineKey);
      const previousCloud = queryClient.getQueryData(cloudKey);

      // Create optimistic quest data
      const optimisticQuest = {
        id: `temp-${Date.now()}`, // Temporary ID until real one is returned
        name: values.name,
        description: values.description || null,
        project_id: projectId,
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
        projectId,
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
    },
    onError: (error, values, context) => {
      console.error('Failed to create quest', error);

      // Rollback optimistic update on error
      if (context?.previousOffline) {
        const baseKey = [
          'quests',
          'infinite',
          'for-project',
          projectId,
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
          projectId,
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
      return (
        <View className="align-start flex-1">
          <View className="m-4 mb-0">
            <InviteMembersBanner
              show={showInviteBanner}
              onDismiss={() => dismissInviteBanner(projectId || '')}
              onInvite={() => openMembershipModal('invited')}
            />
          </View>
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
                testID="project-request-access"
                accessibilityLabel="Request Membership"
              >
                <Icon as={LockIcon} size={16} />
                <Text>{t('requestMembership')}</Text>
              </Button>
            )}
          </View>
          <BibleBookList
            projectId={projectId!}
            onBookSelect={handleBookSelect}
            existingBookIds={existingBookIds}
            canCreateNew={isMember}
          />
        </View>
      );
    }

    // FIA project routing. Guests have no Settings, so skip the
    // experimental opt-in and let them browse like other public projects.
    if (template === 'fia') {
      if (!enableFia && currentUser) {
        return (
          <View className="flex-1 items-center justify-center gap-4 p-8">
            <Icon
              as={SettingsIcon}
              size={40}
              className="text-muted-foreground"
            />
            <Text variant="h4" className="text-center">
              {t('fiaExperimentalTitle')}
            </Text>
            <Text className="text-center text-muted-foreground">
              {t('enableFiaPrompt')}
            </Text>
            <Button
              variant="default"
              onPress={() => router.push('/(app)/settings')}
              testID="fia-open-settings"
              accessibilityLabel="fia-open-settings"
            >
              <Icon as={SettingsIcon} size={16} />
              <Text>{t('openSettings')}</Text>
            </Button>
          </View>
        );
      }

      return (
        <View className="align-start flex-1">
          <View className="m-4 mb-0">
            <InviteMembersBanner
              show={showInviteBanner}
              onDismiss={() => dismissInviteBanner(projectId || '')}
              onInvite={() => openMembershipModal('invited')}
            />
          </View>
          <View className="flex-col items-center justify-between gap-3 p-4">
            <View className="flex flex-row items-center gap-3">
              <Icon as={BookOpenIcon} />
              <Text variant="h4">{projectName}</Text>
            </View>
            {isPrivateProject && !isMember && currentUser && (
              <Button
                variant="default"
                size="sm"
                onPress={() => setShowPrivateAccessModal(true)}
                testID="project-request-access"
                accessibilityLabel="Request Membership"
              >
                <Icon as={LockIcon} size={16} />
                <Text>{t('requestMembership')}</Text>
              </Button>
            )}
          </View>
          <FiaBookList
            books={fiaBooks}
            isLoading={fiaLoading}
            error={fiaError}
            existingBookIds={existingFiaBookIds}
            canCreateNew={isMember}
            onBookSelect={handleFiaBookSelect}
            onRefresh={() => void refetchFia()}
          />
        </View>
      );
    }

    // Default unstructured project view
    return (
      <View className="flex-1 flex-col gap-4 p-6 pt-0">
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
                  await invalidateCloud(queryClient, 'quests');
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
                testID="project-request-access"
                accessibilityLabel="Request Membership"
              >
                <Icon as={LockIcon} size={16} />
                <Text>{t('requestMembership')}</Text>
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
            testID="quests-search"
            accessibilityLabel="quests-search"
            suffix={
              questListFetching && searchQuery ? (
                <ActivityIndicator
                  size="small"
                  color={getThemeColor('primary')}
                />
              ) : undefined
            }
            suffixStyling={false}
            hitSlop={12}
          />

          {/* Invite Members Banner for Solo Projects - below search bar */}
          <InviteMembersBanner
            show={showInviteBanner}
            onDismiss={() => dismissInviteBanner(projectId || '')}
            onInvite={() => openMembershipModal('invited')}
          />
        </View>

        <View className="pb-safe flex flex-1 flex-col gap-2">
          {/* Quest List - Separated component to prevent search input re-renders */}
          <QuestListView
            projectId={projectId!}
            searchQuery={searchQuery}
            projectSource={project?.source || 'local'}
            isMember={isMember}
            onAddChild={openCreateForParent}
            onOpenQuest={(quest) =>
              void questDownloadFlow.openQuest(quest, isMember)
            }
            onDownloadClick={(questId) =>
              void questDownloadFlow.toggle(questId)
            }
            onCloudLoadingChange={setQuestListCloudLoading}
            onFetchingChange={setQuestListFetching}
            downloadingQuestId={questDownloadFlow.pendingDownloadQuestId}
            downloadingQuestIds={questDownloadFlow.downloadingQuestIds}
            downloadedQuestIds={questDownloadFlow.downloadedQuestIds}
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
                testID="quest-create-button"
                accessibilityLabel="quest-create-button"
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
      {projectName && <Stack.Screen options={{ title: projectName }} />}
      {template === 'bible' || template === 'fia' ? (
        // Bible/FIA project - no Form/Drawer needed (quests come from structured content)
        <View className="flex-1">{renderContent()}</View>
      ) : (
        // Unstructured project - needs Form/Drawer for quest creation
        <Drawer
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
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
                          testID="quest-create-name"
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
                  testID="quest-create-submit"
                  accessibilityLabel="quest-create-submit"
                  onPress={form.handleSubmit((data) => createQuest(data))}
                >
                  <Text>{t('createObject')}</Text>
                </FormSubmit>
                <DrawerClose>
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
                    testID="project-report"
                  />
                ) : null}
                {project?.source !== 'local' &&
                  (isMember || !isPrivateProject) && (
                    <SpeedDialItem
                      icon={UsersIcon}
                      variant="outline"
                      onPress={() => openMembershipModal('members')}
                      testID="project-membership"
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
          <SpeedDialTrigger testID="project-speed-dial" />
        </SpeedDial>
      </View>

      {/* Shared Modals */}
      <ProjectMembershipModal
        isVisible={showMembershipModal}
        onClose={() => setShowMembershipModal(false)}
        projectId={projectId || ''}
        initialTab={membershipModalInitialTab}
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
          projectId={projectId || ''}
        />
      ) : (
        <ReportModal
          isVisible={showReportModal}
          onClose={() => setShowReportModal(false)}
          recordId={projectId!}
          creatorId={project?.creator_id ?? undefined}
          recordTable="project"
          hasAlreadyReported={hasReported}
          onReportSubmitted={() => null}
        />
      )}

      <PrivateAccessGate
        projectId={projectId || ''}
        projectName={projectName || ''}
        isPrivate={isPrivateProject}
        action="contribute"
        modal={true}
        isVisible={showPrivateAccessModal}
        onClose={() => setShowPrivateAccessModal(false)}
      />

      {questDownloadFlow.sheets}
    </>
  );
}
