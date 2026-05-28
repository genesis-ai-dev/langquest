import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import { invite, profile_project_link, project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useUserRestrictions } from '@/hooks/db/useBlocks';

import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn, getThemeColor } from '@/utils/styleUtils';
import {
  useHybridData,
  useSimpleHybridInfiniteData
} from '@/views/new/useHybridData';
import { LegendList } from '@legendapp/list';
import {
  and,
  desc,
  eq,
  getTableColumns,
  like,
  notExists,
  notInArray,
  or
} from 'drizzle-orm';
import { useRouter } from 'expo-router';
import {
  ArrowRightIcon,
  PlusIcon,
  SearchIcon,
  UserIcon
} from 'lucide-react-native';
import React, { useEffect } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreateProjectView } from './CreateProjectView';
import { InvitedProjectListItem } from './InvitedProjectListItem';
import { ProjectListItem } from './ProjectListItem';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQueryClient } from '@tanstack/react-query';

type TabType = 'my' | 'all';

type Project = typeof project.$inferSelect;

export default function NextGenProjectsView() {
  // Access db inside component to avoid module-level access before PowerSync is ready
  const { db } = system;
  const { t } = useLocalization();
  const { currentUser, isAuthenticated } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<TabType>('my');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const showInvisibleContent = useLocalStore(
    (state) => state.showHiddenContent
  );

  const { data: restrictions } = useUserRestrictions(
    'project',
    true,
    true,
    false
  );

  const blockContentIds = (restrictions.blockedContentIds ?? []).map(
    (c) => c.content_id
  );
  const blockUserIds = (restrictions.blockedUserIds ?? []).map(
    (c) => c.blocked_id
  );

  // Query for My Projects (user is owner or member)
  const userId = currentUser?.id;
  const userEmail = currentUser?.email;

  // Query for projects where user is owner or member
  // Disable for anonymous users (no "My Projects" when not logged in)
  const myProjectsQuery = useHybridData({
    dataType: 'my-projects',
    queryKeyParams: [userId || '', searchQuery],
    enabled: !!userId, // Only enable if user is logged in
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          ...getTableColumns(project)
        })
        .from(project)
        .innerJoin(
          profile_project_link,
          eq(project.id, profile_project_link.project_id)
        )
        .where(
          and(
            ...[
              userId ? eq(profile_project_link.profile_id, userId) : undefined,
              eq(profile_project_link.active, true),
              or(
                !showInvisibleContent ? eq(project.visible, true) : undefined,
                userId ? eq(project.creator_id, userId) : undefined
              ),
              searchQuery &&
                or(
                  like(project.name, `%${searchQuery.trim()}%`),
                  like(project.description, `%${searchQuery.trim()}%`)
                )
            ].filter(Boolean)
          )
        )
    ),
    cloudQueryFn: async () => {
      if (!userId) return [];

      // Query projects where user is creator or member
      let query = system.supabaseConnector.client
        .from('project')
        .select(
          `
          *,
          profile_project_link!inner(profile_id)
        `
        )
        .eq('profile_project_link.profile_id', userId);

      if (!showInvisibleContent) query = query.eq('visible', true);
      if (searchQuery.trim())
        query = query.or(
          `name.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`
        );

      const { data, error } = await query.overrideTypes<Project[]>();

      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!userId,
    enableOfflineQuery: !!userId
  });

  // Watch for invite changes and membership changes to invalidate queries
  // We watch both invites and profile_project_link because:
  // 1. Watching invites detects when new invites arrive
  // 2. Watching memberships detects when invites are accepted (creates membership)
  // 3. Watching invites with any status detects when pending invites change to accepted/declined
  React.useEffect(() => {
    if (!userId && !userEmail) return;

    // Use AbortController for cleanup
    const abortController = new AbortController();
    let isMounted = true;

    const shouldProceed = () => !abortController.signal.aborted && isMounted;

    // Helper to invalidate and refetch relevant queries
    const invalidateProjectQueries = async () => {
      if (!shouldProceed()) return;

      // Invalidate queries (triggers automatic refetch in TanStack Query)
      await queryClient.invalidateQueries({
        queryKey: ['invited-projects'],
        exact: false
      });
      await queryClient.invalidateQueries({
        queryKey: ['my-projects'],
        exact: false
      });

      // Explicitly refetch to ensure immediate update
      await queryClient.refetchQueries({
        queryKey: ['invited-projects'],
        exact: false
      });
      await queryClient.refetchQueries({
        queryKey: ['my-projects'],
        exact: false
      });
    };

    // Watch 1: Watch all invites (not just pending) to detect status changes
    // This will fire when an invite changes from pending to accepted/declined
    const _watch1 = system.powersync.watch(
      `SELECT id, status, active, email, receiver_profile_id, project_id, last_updated FROM invite WHERE (email = ? OR receiver_profile_id = ?)`,
      [userEmail || '', userId || ''],
      {
        onResult: () => {
          // Fire and forget - don't block the watch callback
          void invalidateProjectQueries();
        },
        onError: (error) => {
          if (!shouldProceed()) return;
          console.error('Error watching invites:', error);
        }
      },
      { signal: abortController.signal }
    );

    // Watch 2: Watch memberships to detect when invites are accepted (creates membership)
    const _watch2 = userId
      ? system.powersync.watch(
          `SELECT id, profile_id, project_id, active, membership, last_updated FROM profile_project_link WHERE profile_id = ?`,
          [userId],
          {
            onResult: () => {
              // Fire and forget - don't block the watch callback
              void invalidateProjectQueries();
            },
            onError: (error) => {
              if (!shouldProceed()) return;
              console.error('Error watching memberships:', error);
            }
          },
          { signal: abortController.signal }
        )
      : null;

    // Cleanup: abort all watches and mark as unmounted
    return () => {
      isMounted = false;
      abortController.abort();
      // All watches will stop calling callbacks due to abort signal
    };
  }, [userId, userEmail, queryClient]);

  // Query for invites where user has pending invites but is not yet a member
  // Offline-only: PowerSync syncs invite table (via user_profile and project_memberships buckets)
  // When an invite is withdrawn/expired, PowerSync removes it from local DB, and the query
  // automatically updates due to PowerSync watches being reactive

  const invitedInvitesQuery = useHybridData({
    dataType: 'invited-invites',
    queryKeyParams: [userId || '', userEmail || '', searchQuery],
    offlineQuery: toCompilableQuery(
      system.db
        .select({ project_id: invite.project_id, status: invite.status })
        .from(invite)
        .where(
          and(
            ...[
              // Build invite matching condition - at least one must be true
              (userId || userEmail) &&
                or(
                  ...[
                    userId && eq(invite.receiver_profile_id, userId),
                    userEmail && eq(invite.email, userEmail)
                  ].filter(Boolean)
                ),
              eq(invite.status, 'pending'),
              eq(invite.active, true),
              // Exclude projects where user is already a member
              userId &&
                notExists(
                  system.db
                    .select()
                    .from(profile_project_link)
                    .where(
                      and(
                        eq(profile_project_link.project_id, invite.project_id),
                        eq(profile_project_link.profile_id, userId),
                        eq(profile_project_link.active, true)
                      )
                    )
                    .limit(1)
                )
            ].filter(Boolean)
          )
        )
    ),
    enableCloudQuery: false, // Disabled: rely on offline query + PowerSync sync
    enableOfflineQuery: !!(userId || userEmail),
    enabled: isAuthenticated && !!(userId || userEmail) // Ensure query runs when user is authenticated
    // No realtime subscription needed: PowerSync watches are reactive to local DB changes
  });

  const { data: invitedInvitesData = [] } = invitedInvitesQuery;

  // Query for All Projects (excluding user's projects)
  // For anonymous users, this shows all public projects
  const allProjects = useSimpleHybridInfiniteData<Project>(
    'all-projects',
    [userId || 'anonymous', searchQuery], // Include userId and searchQuery in query key
    // Offline query function
    async ({ pageParam, pageSize }) => {
      const offset = pageParam * pageSize;

      // Get projects where user is a member (only if logged in)
      const userProjectLinks = userId
        ? await system.db
            .select()
            .from(profile_project_link)
            .where(
              and(
                eq(profile_project_link.profile_id, userId),
                eq(profile_project_link.active, true)
              )
            )
        : [];

      const userProjectIds = userProjectLinks.map((link) => link.project_id);

      const trimmed = searchQuery.trim();
      const conditions = [
        userProjectIds.length > 0 && notInArray(project.id, userProjectIds),
        !showInvisibleContent && eq(project.visible, true),
        blockUserIds.length > 0 && notInArray(project.creator_id, blockUserIds),
        blockContentIds.length > 0 && notInArray(project.id, blockContentIds),
        trimmed &&
          or(
            like(project.name, `%${trimmed}%`),
            like(project.description, `%${trimmed}%`)
          )
      ];

      const projects = await system.db.query.project.findMany({
        where: and(...conditions.filter(Boolean)),
        orderBy: desc(project.priority),
        limit: pageSize,
        offset
      });

      return projects;
    },
    // Cloud query function
    async ({ pageParam, pageSize }) => {
      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      let query = system.supabaseConnector.client.from('project').select('*');

      // Exclude projects where user is a member (if user is logged in)
      if (userId) {
        const { data: userProjects } = await system.supabaseConnector.client
          .from('profile_project_link')
          .select('project_id')
          .eq('profile_id', userId)
          .overrideTypes<{ project_id: string }[]>();

        if (userProjects && userProjects.length > 0) {
          const userProjectIds = userProjects.map((p) => p.project_id);
          query = query.not('id', 'in', `(${userProjectIds.join(',')})`);
        }
        if (!showInvisibleContent) query = query.eq('visible', true);
        if (blockUserIds.length > 0)
          query = query.or(
            `creator_id.is.null,creator_id.not.in.(${blockUserIds.join(',')})`
          );
        if (blockContentIds.length > 0)
          query = query.not('id', 'in', `(${blockContentIds.join(',')})`);
      } else {
        // Anonymous users: only show visible projects
        if (!showInvisibleContent) query = query.eq('visible', true);
      }

      if (searchQuery.trim())
        query = query.or(
          `name.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`
        );

      query = query.order('priority', { ascending: false });

      const { data, error } = await query
        .range(from, to)
        .overrideTypes<Project[]>();

      if (error) throw error;
      return data;
    },
    20 // pageSize
  );

  // For anonymous users, always use allProjects query (no "my projects")
  // For authenticated users, use the appropriate query based on active tab
  const currentQuery =
    !isAuthenticated || activeTab === 'all' ? allProjects : myProjectsQuery;
  const { data: projectData, isLoading } = currentQuery;

  // Get the first project for onboarding navigation
  const firstProject = React.useMemo(() => {
    if (Array.isArray(projectData) && projectData.length > 0) {
      return projectData[0];
    }
    return null;
  }, [projectData]);

  // Get fetching state for search indicator
  const isFetchingProjects = React.useMemo(() => {
    // For anonymous users or "all" tab, use allProjects fetching state
    if (!isAuthenticated || activeTab === 'all') {
      return allProjects.isFetching;
    } else {
      // For authenticated users on "my" tab, check myProjectsQuery
      return (
        myProjectsQuery.isOfflineLoading ||
        myProjectsQuery.isCloudLoading ||
        invitedInvitesQuery.isOfflineLoading ||
        invitedInvitesQuery.isCloudLoading
      );
    }
  }, [
    activeTab,
    isAuthenticated,
    myProjectsQuery.isOfflineLoading,
    myProjectsQuery.isCloudLoading,
    invitedInvitesQuery.isOfflineLoading,
    invitedInvitesQuery.isCloudLoading,
    allProjects.isFetching
  ]);

  //   // Clean Status Navigation
  const currentContext = useStatusContext();
  currentContext.setLayerStatus(
    LayerType.PROJECT,
    {
      active: true,
      visible: true,
      source: 'local'
    },
    ''
  );

  // Get project IDs from invites for filtering
  const invitedProjectIds = React.useMemo(() => {
    if (activeTab !== 'my' || !Array.isArray(invitedInvitesData)) {
      return new Set<string>();
    }
    return new Set(invitedInvitesData.map((inv) => inv.project_id));
  }, [invitedInvitesData, activeTab]);

  // Process regular projects data
  const data = React.useMemo(() => {
    let projects: Project[] = [];

    // Handle paginated data (with pages property)
    if ('pages' in projectData && Array.isArray(projectData.pages)) {
      const seen = new Set<string>();
      for (const page of projectData.pages) {
        for (const item of page.data) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            projects.push(item);
          }
        }
      }
    } else if (Array.isArray(projectData)) {
      // Handle non-paginated data (array)
      projects = projectData;
    }

    // Filter out projects that have invites (invites will be rendered separately)
    return projects.filter((p) => !invitedProjectIds.has(p.id));
  }, [projectData, invitedProjectIds]);

  // Filter invites based on search query - we'll filter by project_id only
  // The actual project name/description filtering happens in InvitedProjectListItem
  const filteredInvites = React.useMemo(() => {
    if (activeTab !== 'my' || !Array.isArray(invitedInvitesData)) {
      return [];
    }
    // Return all invites - filtering by project name/description will happen
    // after project data is fetched in InvitedProjectListItem
    // Note: SQL query already excludes projects where user is already a member
    return invitedInvitesData;
  }, [invitedInvitesData, activeTab]);

  // Combine invites and regular projects for rendering
  const allItems = React.useMemo(() => {
    const items: (
      | { type: 'invite'; projectId: string }
      | { type: 'project'; project: Project }
    )[] = [];

    // Add invites first
    if (activeTab === 'my') {
      for (const inv of filteredInvites) {
        items.push({ type: 'invite', projectId: inv.project_id });
      }
    }

    // Add regular projects
    for (const proj of data) {
      items.push({ type: 'project', project: proj });
    }

    return items;
  }, [filteredInvites, data, activeTab]);

  const dimensions = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();

  // Handlers for onboarding flow (kept for potential future use)
  const _handleOnboardingCreateProject = () => {
    if (currentUser) {
      setIsCreateOpen(true);
    }
  };

  const _handleOnboardingCreateQuest = () => {
    if (firstProject) {
      router.push(`/(app)/project/${firstProject.id}`);
      // The onboarding will close and user can create quest in ProjectDirectoryView
    }
  };

  const _handleOnboardingStartRecording = () => {
    if (firstProject) {
      // Navigate to project - user can then navigate to a quest and start recording
      router.push(`/(app)/project/${firstProject.id}`);
      // The recording view will be shown when user navigates to a quest
    }
  };

  const _handleOnboardingInviteCollaborators = () => {
    if (firstProject) {
      router.push(`/(app)/project/${firstProject.id}`);
      // User can access project membership modal from project settings
    }
  };

  return (
    <CreateProjectView open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <KeyboardAvoidingView
        className="flex flex-1"
        behavior="padding"
        keyboardVerticalOffset={bottom + 42}
      >
        <View className="flex flex-1 flex-col gap-6 p-4 pt-0">
            <View className="flex flex-col gap-4">
              {/* Tabs */}
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as TabType)}
              >
                <TabsList className="w-full">
                  {isAuthenticated ? (
                    <>
                      <TabsTrigger value="my">
                        <Text>{t('myProjects')}</Text>
                      </TabsTrigger>
                      <TabsTrigger value="all">
                        <Text>{t('allProjects')}</Text>
                      </TabsTrigger>
                    </>
                  ) : (
                    <>
                      <TabsTrigger value="my">
                        <Text>{t('signIn')}</Text>
                      </TabsTrigger>
                      <TabsTrigger value="all">
                        <Text>{t('allProjects')}</Text>
                      </TabsTrigger>
                    </>
                  )}
                </TabsList>
              </Tabs>

              {/* Show login invitation for anonymous users in "my" tab, otherwise show search */}
              {!isAuthenticated && activeTab === 'my' ? (
                <View className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6">
                  <View className="flex flex-col items-center gap-4">
                    <Icon as={UserIcon} size={48} className="text-primary" />
                    <View className="flex flex-col items-center gap-2">
                      <Text variant="h4" className="text-center">
                        {t('signInToSaveOrContribute')}
                      </Text>
                    </View>
                    <Button
                      variant="default"
                      size="lg"
                      onPress={() => router.push('/(auth)/sign-in')}
                      className="w-full"
                    >
                      <Text className="font-semibold">{t('signIn')}</Text>
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onPress={() => router.push('/(auth)/register')}
                      className="w-full"
                    >
                      <Text>{t('createAccount')}</Text>
                    </Button>
                  </View>
                  {/* Arrow and option to view all projects */}
                  <View className="flex flex-col items-center gap-2 border-t border-border pt-4">
                    <Text className="text-sm text-muted-foreground">
                      {t('orBrowseAllProjects')}
                    </Text>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => setActiveTab('all')}
                      className="flex-row items-center gap-2"
                    >
                      <Text>{t('viewAllProjects')}</Text>
                      <Icon as={ArrowRightIcon} size={16} />
                    </Button>
                  </View>
                </View>
              ) : (
                <>
                  {/* Search and filter */}
                  <View className="flex flex-row items-center gap-2">
                    <Input
                      className="flex-1"
                      placeholder={t('searchProjects')}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      prefix={SearchIcon}
                      prefixStyling={false}
                      size="sm"
                      returnKeyType="search"
                      suffix={
                        isFetchingProjects && searchQuery ? (
                          <ActivityIndicator
                            size="small"
                            color={getThemeColor('primary')}
                          />
                        ) : undefined
                      }
                      suffixStyling={false}
                      hitSlop={12}
                    />
                    {currentUser && (
                      <Button size="icon-lg" onPress={() => setIsCreateOpen(true)}>
                        <Icon
                          as={PlusIcon}
                          className="text-primary-foreground"
                        />
                      </Button>
                    )}
                  </View>
                </>
              )}
            </View>

            {/* Show project list only if not showing login invitation */}
            {!isAuthenticated && activeTab === 'my' ? null : isLoading ||
              (isFetchingProjects && searchQuery && allItems.length === 0) ? (
              <ProjectListSkeleton />
            ) : (
              <LegendList
                key={`${activeTab}-${dimensions.width}-${allItems.length}`}
                data={allItems}
                columnWrapperStyle={{ gap: 12 }}
                numColumns={
                  dimensions.width > 768 && allItems.length > 1 ? 2 : 1
                }
                keyExtractor={(item) =>
                  item.type === 'invite'
                    ? `invite-${item.projectId}-${activeTab}`
                    : `project-${item.project.id}-${activeTab}`
                }
                contentContainerClassName="pb-8"
                recycleItems
                estimatedItemSize={175}
                maintainVisibleContentPosition
                renderItem={({ item }) => {
                  if (item.type === 'invite') {
                    return (
                      <InvitedProjectListItem
                        projectId={item.projectId}
                        searchQuery={searchQuery}
                        className={cn(dimensions.width > 768 && 'h-[212px]')}
                      />
                    );
                  }
                  return (
                    <ProjectListItem
                      project={item.project}
                      className={cn(dimensions.width > 768 && 'h-[212px]')}
                    />
                  );
                }}
                onEndReached={() => {
                  if (
                    allProjects.hasNextPage &&
                    !allProjects.isFetchingNextPage
                  ) {
                    allProjects.fetchNextPage();
                  }
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={() =>
                  allProjects.isFetchingNextPage && (
                    <View className="p-4">
                      <ActivityIndicator
                        size="small"
                        color={getThemeColor('primary')}
                      />
                    </View>
                  )
                }
                ListEmptyComponent={() => (
                  <View className="flex-1 items-center justify-center py-16">
                    <View className="flex-col items-center gap-2">
                      <Text className="text-muted-foreground">
                        {searchQuery
                          ? t('noProjectsFound')
                          : activeTab === 'my'
                            ? t('noProjectsYet')
                            : t('noProjectsAvailable')}
                      </Text>
                      {activeTab === 'my' && !searchQuery && (
                        <Button
                          variant="default"
                          onPress={() => setIsCreateOpen(true)}
                          className="mt-2"
                        >
                          <Icon as={PlusIcon} size={16} />
                          <Text>{t('newProject')}</Text>
                        </Button>
                      )}
                    </View>
                  </View>
                )}
              />
            )}
        </View>
      </KeyboardAvoidingView>
    </CreateProjectView>
  );
}
