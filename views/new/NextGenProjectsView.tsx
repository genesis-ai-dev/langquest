import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import { profile_project_link, project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useUserRestrictions } from '@/hooks/db/useBlocks';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
import { useSimpleHybridInfiniteData } from '@/views/new/useHybridData';
import { LegendList } from '@legendapp/list';
import { and, eq, inArray, like, notInArray, or } from 'drizzle-orm';
import { FolderPenIcon, PlusIcon, SearchIcon } from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  View
} from 'react-native';
import { ProjectListItem } from './ProjectListItem';

// New imports for bottom sheet + form
import { LanguageSelect } from '@/components/language-select';
import {
  BottomSheetHandle,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView
} from '@/components/ui/bottom-sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  transformInputProps,
  transformSwitchProps
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { templateOptions } from '@/db/constants';
import {
  profile_project_link_local,
  project_local
} from '@/db/drizzleSchemaLocal';
import { useLocalStore } from '@/store/localStore';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useSharedValue } from 'react-native-reanimated';
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
  const bottomSheetRef = React.useRef<BottomSheetModal>(null);
  const animatedIndex = useSharedValue(0);
  const animatedPosition = useSharedValue(0);

  const currentLanguageId = useLocalStore((state) => state.languageId);

  const formSchema = z.object({
    name: z.string({ required_error: t('nameRequired') }),
    target_language_id: z.string({ required_error: t('selectLanguage') }),
    description: z
      .string()
      .max(196, {
        message: t('descriptionTooLong', {
          max: 196
        })
      })
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
            .insert(project_local)
            .values({
              ...values,
              name: values.name.trim(),
              description: values.description?.trim(),
              creator_id: currentUser!.id,
              download_profiles: [currentUser!.id]
            })
            .returning();
          if (!newProject) throw new Error('Failed to create project');
          await tx.insert(profile_project_link_local).values({
            id: `${currentUser!.id}_${newProject.id}`,
            project_id: newProject.id,
            profile_id: currentUser!.id,
            membership: 'owner'
          });
        });
      },
      onSuccess: () => {
        // Close and refresh
        form.reset();
        bottomSheetRef.current?.dismiss();
        setIsCreateOpen(false);
        void currentQuery.refetch();
      },
      onError: (error) => {
        console.error('Failed to create project', error);
      }
    });

  const form = useForm<FormData>({
    defaultValues: {
      private: true,
      visible: false,
      template: 'unstructured',
      target_language_id: currentLanguageId ?? undefined
    },
    resolver: zodResolver(formSchema),
    disabled: isCreatingProject && !currentUser?.id
  });

  //   // Clean Status Navigation
  const currentContext = useStatusContext();
  currentContext.setLayerStatus(
    LayerType.PROJECT,
    { active: true, visible: true },
    ''
  );
  const showInvisibleContent = currentContext.showInvisibleContent;

  const {
    data: restrictions
    // isRestrictionsLoading,
    // refetch: refetchRestrictions
  } = useUserRestrictions('projects', true, true, false);

  const blockContentIds = (restrictions.blockedContentIds ?? []).map(
    (c) => c.content_id
  );
  const blockUserIds = (restrictions.blockedUserIds ?? []).map(
    (c) => c.blocked_id
  );

  // Query for My Projects (user is owner or member)
  const userId = currentUser?.id;
  //   // Query for My Projects (user is owner or member)
  const myProjectsQuery = useSimpleHybridInfiniteData<Project>(
    'my-projects',
    [userId || '', searchQuery], // Include userId and searchQuery in query key
    // Offline query function
    async ({ pageParam, pageSize }) => {
      if (!userId) return [];

      const offset = pageParam * pageSize;

      // Query projects where user is linked through profile_project_link
      const projectLinks = await system.db
        .select()
        .from(profile_project_link)
        .where(
          and(
            eq(profile_project_link.profile_id, userId),
            eq(profile_project_link.active, true)
          )
        );

      if (projectLinks.length === 0) return [];

      const projectIds = projectLinks.map((link) => link.project_id);

      const conditions = [
        inArray(project.id, projectIds),
        !showInvisibleContent && eq(project.visible, true),
        searchQuery &&
          or(
            like(project.name, `%${searchQuery.trim()}%`),
            like(project.description, `%${searchQuery.trim()}%`)
          )
      ];

      const projects = await system.db.query.project.findMany({
        where: and(...conditions.filter(Boolean)),
        limit: pageSize,
        offset
      });

      return projects;
    },
    // Cloud query function
    async ({ pageParam, pageSize }) => {
      if (!userId) return [];

      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      // Query projects where user is creator or member
      let query = system.supabaseConnector.client
        .from('project')
        .select(
          `
          *,
          profile_project_link!inner(profile_id)
        `
        )
        .eq('profile_project_link.profile_id', userId)
        .range(from, to);
      if (!showInvisibleContent) query = query.eq('visible', true);
      if (searchQuery.trim())
        query = query.or(
          `name.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`
        );
      const { data, error } = await query.overrideTypes<Project[]>();

      if (error) throw error;
      return data;
    },
    async ({ pageParam, pageSize }) => {
      if (!userId) return [];

      const offset = pageParam * pageSize;

      // Query projects where user is linked through profile_project_link
      const projectLinks = await system.db
        .select()
        .from(profile_project_link_local)
        .where(
          and(
            eq(profile_project_link_local.profile_id, userId),
            eq(profile_project_link_local.active, true)
          )
        );

      if (projectLinks.length === 0) return [];

      const projectIds = projectLinks.map((link) => link.project_id);

      const conditions = [
        inArray(project.id, projectIds),
        !showInvisibleContent && eq(project_local.visible, true),
        searchQuery &&
          or(
            like(project_local.name, `%${searchQuery.trim()}%`),
            like(project_local.description, `%${searchQuery.trim()}%`)
          )
      ];

      const projects = await system.db.query.project_local.findMany({
        where: and(...conditions.filter(Boolean)),
        limit: pageSize,
        offset
      });

      return projects;
    },
    20 // pageSize
  );

  // Query for All Projects (excluding user's projects)
  const allProjectsQuery = useSimpleHybridInfiniteData<Project>(
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
        eq(project.active, true),
        userProjectIds.length > 0 && notInArray(project.id, userProjectIds),
        !showInvisibleContent ? eq(project.visible, true) : undefined,
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

      const { data, error } = await query
        .range(from, to)
        .overrideTypes<Project[]>();

      if (error) throw error;
      return data;
    },
    async ({ pageParam, pageSize }) => {
      const offset = pageParam * pageSize;

      // Get projects where user is a member
      const userProjectLinks = await system.db
        .select()
        .from(profile_project_link_local)
        .where(
          and(
            eq(profile_project_link_local.profile_id, userId!),
            eq(profile_project_link_local.active, true)
          )
        );

      const userProjectIds = userProjectLinks.map((link) => link.project_id);

      const trimmed = searchQuery.trim();
      const conditions = [
        eq(project_local.active, true),
        userProjectIds.length > 0 &&
          notInArray(project_local.id, userProjectIds),
        !showInvisibleContent ? eq(project_local.visible, true) : undefined,
        blockUserIds.length > 0 &&
          notInArray(project_local.creator_id, blockUserIds),
        blockContentIds.length > 0 &&
          notInArray(project_local.id, blockContentIds),
        trimmed &&
          or(
            like(project_local.name, `%${trimmed}%`),
            like(project_local.description, `%${trimmed}%`)
          )
      ];

      const projects = await system.db.query.project_local.findMany({
        where: and(...conditions.filter(Boolean)),
        limit: pageSize,
        offset
      });

      return projects;
    },
    20 // pageSize
  );

  // Use the appropriate query based on active tab
  const currentQuery = activeTab === 'my' ? myProjectsQuery : allProjectsQuery;
  const {
    data: projects,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = currentQuery;

  const data = projects.pages.flatMap((page) => page.data);

  const dimensions = useWindowDimensions();

  return (
    <BottomSheetModalProvider>
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
            />
            <Button
              size="icon-lg"
              onPress={() => {
                if (isCreateOpen) {
                  if (Platform.OS !== 'web') bottomSheetRef.current?.dismiss();
                  setIsCreateOpen(false);
                } else {
                  if (Platform.OS !== 'web') bottomSheetRef.current?.present();
                  setIsCreateOpen(true);
                }
              }}
            >
              <Icon as={PlusIcon} />
            </Button>
          </View>
        </View>

        {isLoading ? (
          <ProjectListSkeleton />
        ) : (
          <LegendList
            key={`${activeTab}-${dimensions.width}`}
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
                className={cn(dimensions.width > 768 && 'h-[212px]')}
              />
            )}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={() =>
              isFetchingNextPage && (
                <View className="p-4">
                  <ActivityIndicator size="small" className="text-primary" />
                </View>
              )
            }
          />
        )}
      </View>

      {/* Create Project Bottom Sheet */}
      <BottomSheetModal
        ref={bottomSheetRef}
        index={-1}
        open={isCreateOpen}
        snapPoints={['70%']}
        handleComponent={() =>
          Platform.OS !== 'web' && (
            <BottomSheetHandle
              className="mt-2 bg-muted"
              animatedIndex={animatedIndex}
              animatedPosition={animatedPosition}
            />
          )
        }
      >
        <BottomSheetView className="flex-1 bg-background px-4 pb-8">
          {Platform.OS === 'web' && (
            <BottomSheetHandle
              className="mt-2 bg-muted"
              animatedIndex={animatedIndex}
              animatedPosition={animatedPosition}
            />
          )}

          <Form {...form}>
            <View className="flex flex-col gap-4">
              <Text className="mt-2 text-lg font-semibold">
                {t('newProject')}
              </Text>

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
                        <LanguageSelect
                          {...field}
                          onChange={(value) => field.onChange(value.id)}
                        />
                        {/* <Select
                          {...transformSelectProps(field, (value) =>
                            getLanguageOption(
                              languages.find((l) => l.id === value)
                            )
                          )}
                        >
                          <SelectTrigger>
                            <View className="flex flex-row items-center justify-start gap-2">
                              <Icon
                                as={LanguagesIcon}
                                className="text-muted-foreground"
                              />
                              <SelectValue
                                className="flex-1 text-base text-foreground"
                                placeholder={t('selectLanguage')}
                              />
                            </View>
                          </SelectTrigger>
                          <SelectContent className="w-full">
                            {languages
                              .filter(
                                (l) => (l.native_name || l.english_name) && l.id
                              )
                              .map((lang) => (
                                <SelectItem
                                  key={lang.id}
                                  {...getLanguageOption(lang)!}
                                >
                                  {getLanguageOption(lang)!.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select> */}
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <View className="mt-1 flex-row items-center justify-between">
                <Text>{t('visible') || 'Visible'}</Text>
                <FormField
                  control={form.control}
                  name="visible"
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
              <View className="flex-row items-center justify-between">
                <Text>{t('private') || 'Private'}</Text>
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

              {/* Submit */}
              <Button
                disabled={isCreatingProject}
                onPress={form.handleSubmit((data) => createProject(data))}
              >
                <Text className="text-sm font-medium text-primary-foreground">
                  {t('createObject')}
                </Text>
              </Button>
            </View>
          </Form>
        </BottomSheetView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  );
}
