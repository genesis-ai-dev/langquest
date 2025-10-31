import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import { invite, profile_project_link, project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useUserRestrictions } from '@/hooks/db/useBlocks';
import { useLocalization } from '@/hooks/useLocalization';
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
  notInArray,
  or,
  sql
} from 'drizzle-orm';
import { FolderPenIcon, PlusIcon, SearchIcon } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
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
import { resolveTable } from '@/utils/dbUtils';
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
        void currentQuery.refetch();
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

  const {
    data: restrictions
    // isRestrictionsLoading,
    // refetch: refetchRestrictions
  } = useUserRestrictions('project', true, true, false);

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
          eq(project.id, profile_project_link.project_id)
        )
        .where(
          and(
            ...[
              eq(profile_project_link.profile_id, userId!),
              eq(profile_project_link.active, true),
              or(
                !showInvisibleContent ? eq(project.visible, true) : undefined,
                eq(project.creator_id, currentUser!.id)
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

  // Query for projects where user has pending invites but is not yet a member
  const invitedProjectsQuery = useHybridData({
    dataType: 'invited-projects',
    queryKeyParams: [userId || '', userEmail || '', searchQuery],
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          ...getTableColumns(project)
        })
        .from(project)
        .innerJoin(invite, eq(project.id, invite.project_id))
        .where(
          and(
            ...[
              // Build invite matching condition - at least one must be true
              (userId || userEmail) &&
                or(
                  userId ? eq(invite.receiver_profile_id, userId) : undefined,
                  userEmail ? eq(invite.email, userEmail) : undefined
                ),
              eq(invite.status, 'pending'),
              eq(invite.active, true),
              // Exclude projects where user is already a member (only if userId exists)
              userId &&
                sql`NOT EXISTS (
                  SELECT 1 FROM ${profile_project_link}
                  WHERE ${profile_project_link.project_id} = ${project.id}
                  AND ${profile_project_link.profile_id} = ${userId}
                  AND ${profile_project_link.active} = 1
                )`,
              or(
                !showInvisibleContent ? eq(project.visible, true) : undefined,
                eq(project.creator_id, currentUser!.id)
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
      if (!userId && !userEmail) return [];

      // Get projects where user is already a member (to exclude)
      const { data: userMemberships } = userId
        ? await system.supabaseConnector.client
            .from('profile_project_link')
            .select('project_id')
            .eq('profile_id', userId)
            .eq('active', true)
            .overrideTypes<{ project_id: string }[]>()
        : { data: [] };

      const memberProjectIds = userMemberships?.map((m) => m.project_id) || [];

      // Query for projects with pending invites
      // Build OR condition for receiver_profile_id or email
      const inviteConditions: string[] = [];
      if (userId) {
        inviteConditions.push(`receiver_profile_id.eq.${userId}`);
      }
      if (userEmail) {
        inviteConditions.push(`email.eq.${userEmail}`);
      }

      if (inviteConditions.length === 0) return [];

      const inviteQuery = system.supabaseConnector.client
        .from('invite')
        .select('project_id')
        .eq('status', 'pending')
        .eq('active', true)
        .or(inviteConditions.join(','));

      const { data: invites, error: inviteError } =
        await inviteQuery.overrideTypes<{ project_id: string }[]>();

      if (inviteError) throw inviteError;

      const invitedProjectIds = invites
        ?.map((inv) => inv.project_id)
        .filter((id) => !memberProjectIds.includes(id));

      if (invitedProjectIds.length === 0) return [];

      // Query the actual projects
      let query = system.supabaseConnector.client
        .from('project')
        .select('*')
        .in('id', invitedProjectIds);

      if (!showInvisibleContent) query = query.eq('visible', true);
      if (searchQuery.trim())
        query = query.or(
          `name.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`
        );

      const { data, error } = await query.overrideTypes<Project[]>();

      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!(userId || userEmail),
    enableOfflineQuery: !!(userId || userEmail)
  });

  // Query for All Projects (excluding user's projects)
  const allProjects = useSimpleHybridInfiniteData<Project>(
    'all-projects',
    [userId || '', searchQuery], // Include userId and searchQuery in query key
    // Offline query function
    async ({ pageParam, pageSize }) => {
      const offset = pageParam * pageSize;

      // Get projects where user is a member
      const userProjectLinks = await system.db
        .select()
        .from(profile_project_link)
        .where(
          and(
            eq(profile_project_link.profile_id, userId!),
            eq(profile_project_link.active, true)
          )
        );

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

  // Use the appropriate query based on active tab
  const currentQuery = activeTab === 'my' ? myProjectsQuery : allProjects;
  const { data: projectData, isLoading } = currentQuery;
  const { data: invitedProjectsData = [] } =
    activeTab === 'my' ? invitedProjectsQuery : { data: [] };

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

  // Track invited project IDs for special styling
  const invitedProjectIds = React.useMemo(() => {
    if (activeTab !== 'my' || !Array.isArray(invitedProjectsData)) {
      return new Set<string>();
    }
    return new Set(invitedProjectsData.map((p) => p.id));
  }, [invitedProjectsData, activeTab]);

  const data = React.useMemo(() => {
    let projects: (Project & { isInvited?: boolean })[] = [];

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

    // Merge invited projects for "my projects" tab
    if (activeTab === 'my' && Array.isArray(invitedProjectsData)) {
      const seenIds = new Set(projects.map((p) => p.id));
      for (const invitedProject of invitedProjectsData) {
        if (!seenIds.has(invitedProject.id)) {
          projects.push({ ...invitedProject, isInvited: true });
          seenIds.add(invitedProject.id);
        }
      }
    }

    // Mark existing projects as invited if they're in the invited set
    projects = projects.map((project) => ({
      ...project,
      isInvited: invitedProjectIds.has(project.id) || project.isInvited
    }));

    // Sort: invited projects first, then regular projects
    projects.sort((a, b) => {
      if (a.isInvited && !b.isInvited) return -1;
      if (!a.isInvited && b.isInvited) return 1;
      return 0;
    });

    return projects;
  }, [projectData, invitedProjectsData, activeTab, invitedProjectIds]);

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
      <View className="flex flex-1 flex-col gap-6 p-6">
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
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            />
            <DrawerTrigger className={buttonVariants({ size: 'icon-lg' })}>
              <Icon as={PlusIcon} className="text-primary-foreground" />
            </DrawerTrigger>
          </View>
        </View>

        {isLoading ? (
          <ProjectListSkeleton />
        ) : (
          <LegendList
            key={`${activeTab}-${dimensions.width}-${data.length}`}
            data={data}
            columnWrapperStyle={{ gap: 12 }}
            numColumns={dimensions.width > 768 && data.length > 1 ? 2 : 1}
            keyExtractor={(item) => item.id}
            recycleItems
            estimatedItemSize={175}
            maintainVisibleContentPosition
            renderItem={({ item }) => (
              <ProjectListItem
                project={item}
                isInvited={item.isInvited}
                className={cn(dimensions.width > 768 && 'h-[212px]')}
              />
            )}
            onEndReached={() => {
              if (allProjects.hasNextPage && !allProjects.isFetchingNextPage) {
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
