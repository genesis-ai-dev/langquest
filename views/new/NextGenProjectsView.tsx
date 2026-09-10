import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { Button } from '@/components/ui/button';
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
import type { WithSource } from '@/utils/dbUtils';
import { cn, getThemeColor } from '@/utils/styleUtils';
import {
  useHybridInfiniteQuery,
  useHybridQuery
} from '@/hooks/useHybridQuery';
import RNAlert from '@blazejkustra/react-native-alert';
import { LegendList } from '@/components/ui/legend-list';
import {
  and,
  desc,
  eq,
  getTableColumns,
  getTableName,
  like,
  notExists,
  notInArray,
  or
} from 'drizzle-orm';
import { useRouter } from 'expo-router';
import {
  ArrowRightIcon,
  FolderPenIcon,
  PlusIcon,
  SearchIcon,
  UserIcon
} from 'lucide-react-native';
import React, { useEffect } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InvitedProjectListItem } from './InvitedProjectListItem';
import { ProjectListItem } from './ProjectListItem';

// New imports for bottom sheet + form
import { LanguageCombobox } from '@/components/language-combobox';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormSubmit,
  transformInputProps,
  transformSwitchProps
} from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { templateOptions } from '@/db/constants';
import { useFiaLanguoids } from '@/hooks/db/useFiaLanguoids';
import { resolveTable } from '@/utils/dbUtils';
import {
  ensureLanguoidDownloadProfile,
  findOrCreateLanguoidByName
} from '@/utils/languoidUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

type TabType = 'my' | 'all';

type Project = typeof project.$inferSelect;

export default function NextGenProjectsView() {
  // Access db inside component to avoid module-level access before PowerSync is ready
  const { db } = system;
  const { t } = useLocalization();
  const { currentUser, isAuthenticated } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<TabType>('my');

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const formSchema = z
    .object({
      name: z.string(t('nameRequired')).nonempty(t('nameRequired')).trim(),
      // this is the TARGET languoid we're translating to
      target_languoid_id: z
        .string(t('selectLanguage'))
        .min(1, t('selectLanguage')),
      // FIA content language (source) - required when template is 'fia'
      source_languoid_id: z.string().optional(),
      description: z
        .string()
        .max(196, t('descriptionTooLong', { max: 196 }))
        .trim()
        .optional(),
      private: z.boolean(),
      visible: z.boolean(),
      template: z.enum(templateOptions)
    })
    .refine(
      (data) =>
        data.template !== 'fia' ||
        (data.source_languoid_id && data.source_languoid_id.length > 0),
      {
        message: t('selectLanguage'),
        path: ['source_languoid_id']
      }
    );

  type FormData = z.infer<typeof formSchema>;

  const { mutateAsync: createProject, isPending: isCreatingProject } =
    useMutation({
      mutationFn: async (values: FormData) => {
        // Guard against anonymous users
        if (!currentUser?.id) {
          throw new Error('Must be logged in to create projects');
        }

        // Ensure the languoid has this user in download_profiles so it syncs offline
        // This is critical for existing languoids the user didn't create
        await ensureLanguoidDownloadProfile(
          values.target_languoid_id,
          currentUser.id
        );

        // Also ensure source languoid syncs for FIA projects
        if (values.source_languoid_id) {
          await ensureLanguoidDownloadProfile(
            values.source_languoid_id,
            currentUser.id
          );
        }

        // Insert into synced tables (project is published immediately for invites)
        await db.transaction(async (tx) => {
          // Create project (target_language_id is deprecated but still required by schema)
          const { target_languoid_id, source_languoid_id, ...projectValues } =
            values;
          const [newProject] = await tx
            .insert(resolveTable('project', { localOverride: false }))
            .values({
              ...projectValues,
              template: projectValues.template,
              target_language_id: target_languoid_id, // Deprecated field, kept for backward compatibility
              creator_id: currentUser.id,
              download_profiles: [currentUser.id]
            })
            .returning();
          if (!newProject) throw new Error('Failed to create project');

          // Create profile_project_link
          await tx
            .insert(
              resolveTable('profile_project_link', { localOverride: false })
            )
            .values({
              id: `${currentUser.id}_${newProject.id}`,
              project_id: newProject.id,
              profile_id: currentUser.id,
              membership: 'owner'
              // download_profiles will be set by database trigger
            });

          // Create project_language_link with languoid_id
          // PK is (project_id, languoid_id, language_type) - language_id is optional
          const projectLanguageLinkSynced = resolveTable(
            'project_language_link',
            {
              localOverride: false
            }
          );
          await tx.insert(projectLanguageLinkSynced).values({
            project_id: newProject.id,
            language_id: null, // Optional - for backward compatibility
            languoid_id: target_languoid_id, // Required - part of PK
            language_type: 'target',
            active: true,
            download_profiles: [currentUser.id]
          });

          // For FIA projects, also create source language link
          if (source_languoid_id) {
            await tx.insert(projectLanguageLinkSynced).values({
              project_id: newProject.id,
              language_id: null,
              languoid_id: source_languoid_id,
              language_type: 'source',
              active: true,
              download_profiles: [currentUser.id]
            });
          }
        });
      },
      onSuccess: () => {
        setIsCreateOpen(false);
        if (activeTab === 'my') {
          void myProjectsQuery.refetch();
        } else {
          void allProjects.refetch();
        }
      },
      onError: (error) => {
        console.error('Failed to create project', error);
      }
    });

  const savedLanguage = useLocalStore((state) => state.savedLanguage);
  const setSavedLanguage = useLocalStore((state) => state.setSavedLanguage);

  const resetForm = () => {
    form.reset(defaultValues);
    // Handle savedLanguage - it might be a Language (old) or Languoid (new)
    // If it's a Language, we'll need to find/create the corresponding languoid
    if (savedLanguage) {
      // Check if savedLanguage has a 'name' property (Languoid) or 'native_name' (Language)
      if ('name' in savedLanguage && savedLanguage.name) {
        // It's a Languoid
        form.setValue('target_languoid_id', savedLanguage.id);
      } else if (
        'native_name' in savedLanguage ||
        'english_name' in savedLanguage
      ) {
        // It's a Language - find or create corresponding languoid
        const languageName =
          savedLanguage.native_name || savedLanguage.english_name || '';
        if (languageName && currentUser?.id) {
          findOrCreateLanguoidByName(languageName, currentUser.id).then(
            (languoidId) => {
              form.setValue('target_languoid_id', languoidId);
            }
          );
        }
      }
    }
  };

  const defaultValues = {
    private: true,
    visible: true,
    template: 'unstructured',
    name: ''
  } as const;

  const form = useForm<FormData>({
    defaultValues,
    resolver: zodResolver(formSchema),
    disabled: !currentUser?.id
  });

  const watchedTemplate = form.watch('template');
  const isFiaTemplate = watchedTemplate === 'fia';

  const { fiaDropdownData } = useFiaLanguoids();

  useEffect(() => {
    if (savedLanguage && !form.getValues('target_languoid_id')) {
      // Handle savedLanguage - it might be a Language (old) or Languoid (new)
      if ('name' in savedLanguage && savedLanguage.name) {
        // It's a Languoid
        form.setValue('target_languoid_id', savedLanguage.id);
      } else if (
        'native_name' in savedLanguage ||
        'english_name' in savedLanguage
      ) {
        // It's a Language - find or create corresponding languoid
        const languageName =
          savedLanguage.native_name || savedLanguage.english_name || '';
        if (languageName && currentUser?.id) {
          findOrCreateLanguoidByName(languageName, currentUser.id).then(
            (languoidId) => {
              form.setValue('target_languoid_id', languoidId);
            }
          );
        }
      }
    }
  }, [form, savedLanguage, currentUser?.id]);

  const enableFia = useLocalStore((state) => state.enableFia);
  const setEnableFia = useLocalStore((state) => state.setEnableFia);
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
  const myProjectsQuery = useHybridQuery({
    queryKey: ['my-projects', userId || '', searchQuery],
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

      const { data: links, error: linksError } =
        await system.supabaseConnector.client
          .from('profile_project_link')
          .select('project_id')
          .eq('profile_id', userId)
          .eq('active', true);
      if (linksError) throw linksError;

      const projectIds = [
        ...new Set((links ?? []).map((link) => link.project_id))
      ];
      if (projectIds.length === 0) return [];

      let query = system.supabaseConnector.client
        .from('project')
        .select('*')
        .in('id', projectIds);

      // Match the local watch: visible projects, plus the user's own hidden ones.
      if (!showInvisibleContent)
        query = query.or(`visible.eq.true,creator_id.eq.${userId}`);
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

  // Query for invites where user has pending invites but is not yet a member
  const invitedInvitesQuery = useHybridQuery({
    queryKey: ['invited-invites', userId || '', userEmail || '', searchQuery],
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          id: invite.id,
          project_id: invite.project_id,
          status: invite.status
        })
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
    cloudQueryFn: async () => {
      if (!userId && !userEmail) return [];
      const match = [
        userId && `receiver_profile_id.eq.${userId}`,
        userEmail && `email.eq.${userEmail}`
      ]
        .filter(Boolean)
        .join(',');
      let query = system.supabaseConnector.client
        .from('invite')
        .select('id, project_id, status')
        .eq('status', 'pending')
        .eq('active', true);
      if (match) query = query.or(match);
      const { data, error } = await query.overrideTypes<
        { id: string; project_id: string; status: string }[]
      >();
      if (error) throw error;
      if (!userId) return data;
      const { data: memberships, error: membershipError } =
        await system.supabaseConnector.client
          .from('profile_project_link')
          .select('project_id')
          .eq('profile_id', userId)
          .eq('active', true);
      if (membershipError) throw membershipError;
      const memberProjectIds = new Set(
        (memberships ?? []).map((row) => row.project_id)
      );
      return data.filter((row) => !memberProjectIds.has(row.project_id));
    },
    enableOfflineQuery: !!(userId || userEmail),
    enabled: isAuthenticated && !!(userId || userEmail)
  });

  const { data: invitedInvitesData = [] } = invitedInvitesQuery;

  // Query for All Projects (excluding user's projects)
  // For anonymous users, this shows all public projects
  const allProjects = useHybridInfiniteQuery<Project>({
    queryKey: ['all-projects', userId || 'anonymous', searchQuery],
    offlineQueryFn: async ({ pageParam, pageSize }) => {
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
    cloudQueryFn: async ({ pageParam, pageSize }) => {
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
    pageSize: 20,
    watchTables: [getTableName(project), getTableName(profile_project_link)]
  });

  // For anonymous users, always use allProjects query (no "my projects")
  // For authenticated users, use the appropriate query based on active tab
  const currentQuery =
    !isAuthenticated || activeTab === 'all' ? allProjects : myProjectsQuery;
  const { data: projectData, isLoading } = currentQuery;

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

  const myProjectIds = React.useMemo(
    () => new Set(myProjectsQuery.data.map((memberProject) => memberProject.id)),
    [myProjectsQuery.data]
  );

  // Process regular projects data
  const data = React.useMemo(() => {
    let projects: WithSource<Project>[] = [];

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

    return projects;
  }, [projectData]);

  // Pending invites for projects this user is not already a member of.
  // Membership (local or cloud) wins: a stale local invite must not hide a
  // project after the user has joined.
  const filteredInvites = React.useMemo(() => {
    if (activeTab !== 'my' || !Array.isArray(invitedInvitesData)) {
      return [];
    }
    return invitedInvitesData.filter(
      (inv) => !myProjectIds.has(inv.project_id)
    );
  }, [invitedInvitesData, activeTab, myProjectIds]);

  // Combine invites and regular projects for rendering
  const allItems = React.useMemo(() => {
    const items: (
      | { type: 'invite'; projectId: string }
      | { type: 'project'; project: WithSource<Project> }
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

  return (
    <>
      <Drawer
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          resetForm();
        }}
        dismissible={!isCreatingProject}
        snapPoints={[700]}
        enableDynamicSizing={false}
      >
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
                      <DrawerTrigger size="icon-lg">
                        <Icon
                          as={PlusIcon}
                          className="text-primary-foreground"
                        />
                      </DrawerTrigger>
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
                key={`${activeTab}-${dimensions.width}-${allItems
                  .map((item) =>
                    item.type === 'invite'
                      ? `i:${item.projectId}`
                      : `p:${item.project.id}`
                  )
                  .join('|')}`}
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
                bottomExtra={32}
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

        <DrawerContent className="pb-safe">
          <Form {...form}>
            <DrawerHeader>
              <DrawerTitle>{t('newProject')}</DrawerTitle>
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
                        placeholder={t('projectName')}
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
                name="target_languoid_id"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormControl>
                        <LanguageCombobox
                          value={field.value}
                          onChange={(languoid) => {
                            field.onChange(languoid.id);
                            // Note: We don't save languoid to savedLanguage store
                            // because the store still expects Language type (with native_name, etc.)
                            // The form will handle languoid selection directly
                          }}
                          allowCreate
                          onCreateNew={(languoidId) => {
                            field.onChange(languoidId);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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

              <FormField
                control={form.control}
                name="template"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('template')}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={(value) => {
                          if (value === 'fia' && !enableFia) {
                            RNAlert.alert(
                              t('fiaExperimentalTitle'),
                              t('enableFiaPrompt'),
                              [
                                { text: t('cancel'), style: 'cancel' },
                                {
                                  text: t('enable'),
                                  onPress: () => {
                                    setEnableFia(true);
                                    field.onChange(value);
                                  }
                                }
                              ]
                            );
                            return;
                          }
                          field.onChange(value);
                          if (value !== 'fia') {
                            form.setValue('source_languoid_id', undefined);
                          }
                        }}
                      >
                        {templateOptions.map((option) => (
                          <RadioGroupItem
                            key={option}
                            value={option}
                            label={t(option)}
                          >
                            <Text className="capitalize">{t(option)}</Text>
                          </RadioGroupItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isFiaTemplate && (
                <FormField
                  control={form.control}
                  name="source_languoid_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('fiaContentLanguage')}</FormLabel>
                      <FormControl>
                        <Dropdown
                          style={{
                            height: 48,
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            backgroundColor: getThemeColor('card'),
                            borderColor: getThemeColor('border')
                          }}
                          placeholderStyle={{
                            fontSize: 14,
                            color: getThemeColor('muted-foreground')
                          }}
                          selectedTextStyle={{
                            fontSize: 14,
                            color: getThemeColor('foreground')
                          }}
                          containerStyle={{
                            borderRadius: 8,
                            overflow: 'hidden',
                            borderWidth: 1,
                            marginTop: 8,
                            backgroundColor: getThemeColor('card'),
                            borderColor: getThemeColor('border')
                          }}
                          itemTextStyle={{
                            fontSize: 14,
                            color: getThemeColor('foreground')
                          }}
                          itemContainerStyle={{
                            borderRadius: 8,
                            overflow: 'hidden'
                          }}
                          activeColor={getThemeColor('primary')}
                          dropdownPosition="auto"
                          data={fiaDropdownData}
                          maxHeight={300}
                          labelField="label"
                          valueField="value"
                          placeholder={t('fiaContentLanguage')}
                          value={field.value}
                          onChange={(item) => field.onChange(item.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="private"
                render={({ field }) => (
                  <FormItem>
                    <View className="flex-row items-center justify-between">
                      <FormLabel>{t('private')}</FormLabel>
                      <FormControl>
                        <Switch {...transformSwitchProps(field)} />
                      </FormControl>
                    </View>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </View>
            <DrawerFooter>
              <FormSubmit
                onPress={form.handleSubmit((data) => createProject(data))}
                className="flex-row items-center gap-2"
              >
                <Text>{t('createObject')}</Text>
              </FormSubmit>
              <DrawerClose disabled={isCreatingProject}>
                <Text>{t('cancel')}</Text>
              </DrawerClose>
            </DrawerFooter>
          </Form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
