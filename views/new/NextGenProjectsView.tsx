import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import { invite, profile_project_link, project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { cn, getThemeColor } from '@/utils/styleUtils';
import {
  useHybridData,
  useHybridPaginatedInfiniteData
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
  or,
  sql
} from 'drizzle-orm';
import { FolderPenIcon, PlusIcon, SearchIcon } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
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
import { useLocalStore } from '@/store/localStore';
import {
  blockedContentQuery,
  blockedUsersQuery,
  resolveTable
} from '@/utils/dbUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

type TabType = 'my' | 'all';

type Project = typeof project.$inferSelect;

const { db } = system;

export default function NextGenProjectsView() {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<TabType>('my');

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const formSchema = z.object({
    name: z.string(t('nameRequired')).nonempty(t('nameRequired')).trim(),
    // this is the TARGET language we're translating to
    target_language_id: z.uuid(t('selectLanguage')),
    description: z
      .string()
      .max(196, t('descriptionTooLong', { max: 196 }))
      .trim()
      .optional(),
    private: z.boolean(),
    visible: z.boolean(),
    template: z.enum(templateOptions)
  });

  type FormData = z.infer<typeof formSchema>;

  const { mutateAsync: createProject, isPending: isCreatingProject } =
    useMutation({
      mutationFn: async (values: FormData) => {
        // insert into local storage
        await db.transaction(async (tx) => {
          const [newProject] = await tx
            .insert(resolveTable('project', { localOverride: true }))
            .values({
              ...values,
              template: values.template,
              creator_id: currentUser!.id,
              download_profiles: [currentUser!.id]
            })
            .returning();
          if (!newProject) throw new Error('Failed to create project');
          await tx
            .insert(
              resolveTable('profile_project_link', { localOverride: true })
            )
            .values({
              id: `${currentUser!.id}_${newProject.id}`,
              project_id: newProject.id,
              profile_id: currentUser!.id,
              membership: 'owner'
            });
        });
      },
      onSuccess: () => {
        // reset form onOpenChange
        setIsCreateOpen(false);
        // Queries will automatically refetch via realtime subscriptions
        // For immediate update, we can manually refetch if needed
      },
      onError: (error) => {
        console.error('Failed to create project', error);
      }
    });

  const savedLanguage = useLocalStore((state) => state.savedLanguage);

  const resetForm = () => {
    form.reset(defaultValues);
    if (savedLanguage) form.setValue('target_language_id', savedLanguage.id);
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

  useEffect(() => {
    if (savedLanguage && !form.getValues('target_language_id')) {
      form.setValue('target_language_id', savedLanguage.id);
    }
  }, [form, savedLanguage]);

  const showInvisibleContent = useLocalStore(
    (state) => state.showHiddenContent
  );

  // Query for My Projects (user is owner or member)
  const userId = currentUser?.id;
  const userEmail = currentUser?.email;

  const myProjectsQuery = useHybridData({
    dataType: 'my-projects',
    queryKeyParams: [userId || '', searchQuery],
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          ...getTableColumns(project)
        })
        .from(project)
        .innerJoin(
          profile_project_link,
          and(
            eq(project.id, profile_project_link.project_id),
            eq(profile_project_link.active, true),
            eq(profile_project_link.profile_id, userId!)
          )
        )
        .where(
          and(
            ...[
              or(
                ...[
                  !showInvisibleContent && eq(project.visible, true),
                  eq(project.creator_id, currentUser!.id)
                ].filter(Boolean)
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
    // Cloud query kept as fallback for edge cases, but disabled by default
    // cloudQueryFn: async () => {
    //   // Query projects where user is creator or member
    //   let query = system.supabaseConnector.client
    //     .from('project')
    //     .select(
    //       `
    //       *,
    //       profile_project_link!inner(profile_id)
    //     `
    //     )
    //     .eq('profile_project_link.profile_id', userId)
    //     .eq('profile_project_link.active', true);

    //   if (!showInvisibleContent) query = query.eq('visible', true);
    //   if (searchQuery.trim())
    //     query = query.or(
    //       `name.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`
    //     );

    //   const { data, error } = await query.overrideTypes<Project[]>();

    //   if (error) throw error;
    //   return data;
    // },
    enabled: !!userId
  });

  // Query for invites where user has pending invites but is not yet a member
  // Offline-only: PowerSync syncs invite table (via user_profile and project_memberships buckets)
  // When an invite is withdrawn/expired, PowerSync removes it from local DB, and the query
  // automatically updates due to PowerSync watches being reactive
  type Invite = typeof invite.$inferSelect;

  const invitedInvitesQuery = useHybridData<Invite>({
    dataType: 'invited-invites',
    queryKeyParams: [userId || '', userEmail || '', searchQuery],
    offlineQuery: toCompilableQuery(
      system.db
        .select()
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
              // Exclude projects where user is already a member (only if userId exists)
              userId &&
                sql`NOT EXISTS (
                  SELECT 1 FROM ${profile_project_link}
                  WHERE ${profile_project_link.project_id} = ${invite.project_id}
                  AND ${profile_project_link.profile_id} = ${userId}
                  AND ${profile_project_link.active} = 1
                )`
            ].filter(Boolean)
          )
        )
    ),
    enableCloudQuery: false, // Disabled: rely on offline query + PowerSync sync
    enableOfflineQuery: !!(userId || userEmail) && activeTab === 'my'
    // No realtime subscription needed: PowerSync watches are reactive to local DB changes
  });

  const { data: invitedInvitesData = [] } = invitedInvitesQuery;

  // Query for All Projects (excluding user's projects)
  const allProjects = useHybridPaginatedInfiniteData({
    dataType: 'all-projects',
    queryKeyParams: [userId || '', searchQuery], // Include userId and searchQuery in query key
    pageSize: 5,
    // Offline query - returns CompilableQuery
    offlineQuery: ({ page, pageSize }) => {
      const offset = page * pageSize;

      // Get user project IDs for exclusion
      // Note: We need to handle this differently since we can't await in the query builder
      // We'll use a subquery approach
      const trimmed = searchQuery.trim();
      const conditions = [
        userId &&
          notExists(
            system.db
              .select()
              .from(profile_project_link)
              .where(
                and(
                  eq(profile_project_link.project_id, project.id),
                  eq(profile_project_link.profile_id, userId),
                  eq(profile_project_link.active, true)
                )
              )
              .limit(1)
          ),
        !showInvisibleContent && eq(project.visible, true),
        userId && notInArray(project.creator_id, blockedUsersQuery(userId)),
        userId &&
          notInArray(project.id, blockedContentQuery(userId, 'project')),
        trimmed &&
          or(
            like(project.name, `%${trimmed}%`),
            like(project.description, `%${trimmed}%`)
          )
      ];

      return toCompilableQuery(
        system.db.query.project.findMany({
          where: and(...conditions.filter(Boolean)),
          orderBy: desc(project.priority),
          limit: pageSize,
          offset
        })
      );
    },
    // Cloud query function
    cloudQueryFn: async ({ page, pageSize }) => {
      const from = page * pageSize;
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

        // Exclude blocked users
        const { data: blockedUsers } = await system.supabaseConnector.client
          .from('blocked_users')
          .select('blocked_id')
          .eq('blocker_id', userId)
          .overrideTypes<{ blocked_id: string }[]>();

        if (blockedUsers && blockedUsers.length > 0) {
          const blockedUserIds = blockedUsers.map((u) => u.blocked_id);
          query = query.or(
            `creator_id.is.null,creator_id.not.in.(${blockedUserIds.join(',')})`
          );
        }

        // Exclude blocked content
        const { data: blockedContent } = await system.supabaseConnector.client
          .from('blocked_content')
          .select('content_id')
          .eq('profile_id', userId)
          .eq('content_table', 'project')
          .overrideTypes<{ content_id: string }[]>();

        if (blockedContent && blockedContent.length > 0) {
          const blockedContentIds = blockedContent.map((c) => c.content_id);
          query = query.not('id', 'in', `(${blockedContentIds.join(',')})`);
        }
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
    subscribeRealtime: userId
      ? {
          channelName: 'all-projects-realtime',
          subscriptionConfig: {
            table: 'project',
            schema: 'public'
          }
        }
      : undefined
  });

  // Use the appropriate query based on active tab
  const currentQuery = activeTab === 'my' ? myProjectsQuery : allProjects;
  const { data: projectData, isLoading } = currentQuery;

  // Get fetching state for search indicator
  const isFetchingProjects = React.useMemo(() => {
    if (activeTab === 'my') {
      // For myProjectsQuery, check if any loading state is active
      return (
        myProjectsQuery.isOfflineLoading ||
        myProjectsQuery.isCloudLoading ||
        invitedInvitesQuery.isOfflineLoading ||
        invitedInvitesQuery.isCloudLoading
      );
    } else {
      // For allProjects (paginated query), use isFetching
      return allProjects.isFetching;
    }
  }, [
    activeTab,
    myProjectsQuery.isOfflineLoading,
    myProjectsQuery.isCloudLoading,
    invitedInvitesQuery.isOfflineLoading,
    invitedInvitesQuery.isCloudLoading,
    allProjects.isFetching
  ]);

  // Note: No need for profile_project_link realtime subscription - PowerSync queries
  // are automatically reactive to local database changes, and PowerSync will sync
  // profile_project_link changes from Supabase to local DB automatically.

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

    // Handle infinite query data (with pages property)
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
    return invitedInvitesData;
  }, [invitedInvitesData, activeTab]);

  // Combine invites and regular projects for rendering
  const allItems = React.useMemo(() => {
    const items: (
      | { type: 'invite'; invite: Invite }
      | { type: 'project'; project: Project }
    )[] = [];

    // Add invites first
    if (activeTab === 'my') {
      for (const inv of filteredInvites) {
        items.push({ type: 'invite', invite: inv });
      }
    }

    // Add regular projects
    for (const proj of data) {
      items.push({ type: 'project', project: proj });
    }

    return items;
  }, [filteredInvites, data, activeTab]);

  const dimensions = useWindowDimensions();

  return (
    <Drawer
      open={isCreateOpen}
      onOpenChange={(open) => {
        setIsCreateOpen(open);
        resetForm();
      }}
      dismissible={!isCreatingProject}
    >
      <View className="flex flex-1 flex-col gap-6 p-6 pt-0">
        <View className="flex flex-col gap-4">
          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabType)}
          >
            <TabsList className="w-full">
              <TabsTrigger value="my">
                <Text>{t('myProjects')}</Text>
              </TabsTrigger>
              <TabsTrigger value="all">
                <Text>{t('allProjects')}</Text>
              </TabsTrigger>
            </TabsList>
          </Tabs>

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
              suffix={
                isFetchingProjects && searchQuery ? (
                  <ActivityIndicator
                    size="small"
                    color={getThemeColor('primary')}
                  />
                ) : undefined
              }
              suffixStyling={false}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            />
            <DrawerTrigger className={buttonVariants({ size: 'icon-lg' })}>
              <Icon as={PlusIcon} className="text-primary-foreground" />
            </DrawerTrigger>
          </View>
        </View>

        {isLoading ||
        (isFetchingProjects && searchQuery && allItems.length === 0) ? (
          <ProjectListSkeleton />
        ) : (
          <LegendList
            key={`${activeTab}-${dimensions.width}`}
            data={allItems}
            columnWrapperStyle={{ gap: 12 }}
            numColumns={dimensions.width > 768 && allItems.length > 1 ? 2 : 1}
            keyExtractor={(item) =>
              item.type === 'invite'
                ? `invite-${item.invite.id}`
                : `project-${item.project.id}`
            }
            recycleItems
            estimatedItemSize={175}
            maintainVisibleContentPosition
            renderItem={({ item }) => {
              if (item.type === 'invite') {
                return (
                  <InvitedProjectListItem
                    invite={item.invite}
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
                activeTab === 'all' &&
                allProjects.hasNextPage &&
                !allProjects.isFetchingNextPage
              ) {
                allProjects.fetchNextPage();
              }
            }}
            // onEndReachedThreshold={0.5}
            ListFooterComponent={() =>
              activeTab === 'all' &&
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
                      ? 'No projects found'
                      : activeTab === 'my'
                        ? 'No projects yet'
                        : 'No projects available'}
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

      <DrawerContent className="pb-safe">
        <Form {...form}>
          <DrawerHeader>
            <DrawerTitle>{t('newProject')}</DrawerTitle>
          </DrawerHeader>
          <View className="flex flex-col gap-4 px-4">
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
              name="target_language_id"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormControl>
                      <LanguageCombobox
                        value={field.value}
                        onChange={(lang) => field.onChange(lang.id)}
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
                      onValueChange={field.onChange}
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
            <View className="flex-row items-center justify-between">
              <Text>{t('private')}</Text>
              <FormField
                control={form.control}
                name="private"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch {...transformSwitchProps(field)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </View>
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
  );
}
