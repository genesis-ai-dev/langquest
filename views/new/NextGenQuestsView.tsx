import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import {
  BottomSheetHandle,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView
} from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
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
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import { project, quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useDebouncedState } from '@/hooks/use-debounced-state';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useHasUserReported } from '@/hooks/useReports';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/utils/styleUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { LegendList } from '@legendapp/list';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation } from '@tanstack/react-query';
import { and, eq, like, or } from 'drizzle-orm';
import {
  FilterIcon,
  FlagIcon,
  InfoIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  XIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { z } from 'zod';
import { QuestListItem } from './QuestListItem';
import { useHybridData, useSimpleHybridInfiniteData } from './useHybridData';

type Quest = typeof quest.$inferSelect;
type Project = typeof project.$inferSelect;

export default function NextGenQuestsView() {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const { currentProjectId } = useCurrentNavigation();
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [debouncedSearchQuery, searchQuery, setSearchQuery] = useDebouncedState(
    '',
    300
  );
  const [showDownloadedOnly, setShowDownloadedOnly] = useState(false);
  const { hasAccess: canManageProject } = useUserPermissions(
    currentProjectId || '',
    'project_settings_cog'
  );

  const { data: projectData } = useHybridData<Project>({
    dataType: 'project',
    queryKeyParams: [currentProjectId || ''],
    offlineQuery: toCompilableQuery(
      system.db.query.project.findMany({
        where: eq(project.id, currentProjectId || ''),
        limit: 1
      })
    ),
    cloudQueryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('*')
        .eq('id', currentProjectId)
        .overrideTypes<Project[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!currentProjectId
  });
  const currentProject = projectData[0];

  // Create Quest bottom sheet state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const bottomSheetRef = React.useRef<BottomSheetModal>(null);
  const animatedIndex = useSharedValue(0);
  const animatedPosition = useSharedValue(0);

  // Simple create quest form schema
  const formSchema = z.object({
    name: z.string({ required_error: t('nameRequired') }),
    description: z.string().max(196).optional()
  });
  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {}
  });

  const currentStatus = useStatusContext();
  currentStatus.layerStatus(LayerType.PROJECT, currentProjectId || '');
  const { showInvisibleContent } = currentStatus;

  const {
    hasReported,
    isLoading: isReportLoading
    // refetch: refetchReport
  } = useHasUserReported(currentProjectId || '', 'projects');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch
  } = useSimpleHybridInfiniteData<Quest>(
    'quests',
    [currentProjectId || '', debouncedSearchQuery],
    // Offline query function
    async ({ pageParam, pageSize }) => {
      if (!currentProjectId) return [];

      const offset = pageParam * pageSize;

      // Build where conditions
      const baseCondition = eq(quest.project_id, currentProjectId);

      const conditions = [
        baseCondition,
        debouncedSearchQuery.trim() &&
          or(
            like(quest.name, `%${debouncedSearchQuery.trim()}%`),
            like(quest.description, `%${debouncedSearchQuery.trim()}%`)
          ),
        !showInvisibleContent && eq(quest.visible, true)
      ];
      // Add search filtering for offline
      const whereConditions = and(...conditions.filter(Boolean));

      const quests = await system.db.query.quest.findMany({
        where: whereConditions,
        limit: pageSize,
        offset
      });

      return quests;
    },
    // Cloud query function
    async ({ pageParam, pageSize }) => {
      if (!currentProjectId) return [];

      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      let query = system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('project_id', currentProjectId);

      if (!showInvisibleContent) {
        query = query.eq('visible', true);
      }

      // Add search filtering
      if (debouncedSearchQuery.trim()) {
        query = query.or(
          `name.ilike.%${debouncedSearchQuery.trim()}%,description.ilike.%${debouncedSearchQuery.trim()}%`
        );
      }

      const { data, error } = await query
        .range(from, to)
        .overrideTypes<Quest[]>();

      if (error) throw error;
      return data;
    },
    20 // pageSize
  );

  const quests = React.useMemo(() => {
    const allQuests = data.pages.flatMap((page) => page.data);

    // Deduplicate by ID to prevent duplicate keys in FlashList
    const questMap = new Map<string, Quest & { source?: string }>();
    allQuests.forEach((quest) => {
      // Prioritize offline data over cloud data for duplicates
      const existingQuest = questMap.get(quest.id);
      if (
        !existingQuest ||
        (quest.source === 'localSqlite' &&
          existingQuest.source === 'cloudSupabase')
      ) {
        questMap.set(quest.id, quest);
      }
    });

    // Convert back to array and sort by name in natural alphanumerical order
    return Array.from(questMap.values()).sort((a, b) => {
      // Use localeCompare with numeric option for natural sorting
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }, [data.pages]);

  const dimensions = useWindowDimensions();

  // Allow quest creation if the project has a non-empty template value
  const canCreateQuestNow = currentProject?.template;

  const { mutateAsync: createQuest, isPending: isCreatingQuest } = useMutation({
    mutationFn: async (values: FormData) => {
      if (!currentProjectId || !currentUser?.id) return;
      await system.db.insert(quest).values({
        name: values.name.trim(),
        description: values.description?.trim(),
        project_id: currentProjectId,
        creator_id: currentUser.id,
        download_profiles: [currentUser.id]
      });
    },
    onSuccess: () => {
      form.reset();
      if (Platform.OS !== 'web') bottomSheetRef.current?.dismiss();
      setIsCreateOpen(false);
      void refetch();
    },
    onError: (error) => {
      console.error('Failed to create quest', error);
    }
  });

  // Speed dial items are composed inline below

  if (isLoading && !searchQuery) {
    return <ProjectListSkeleton />;
  }

  if (!currentProjectId) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text>{t('noProjectSelected')}</Text>
      </View>
    );
  }

  const filteredQuests = quests.filter((quest) =>
    showDownloadedOnly ? quest.source === 'localSqlite' : true
  );

  return (
    <BottomSheetModalProvider>
      <View className="flex flex-1 flex-col gap-6 p-6 pb-0">
        <View className="flex flex-col gap-4">
          <Text className="text-xl font-semibold">{t('quests')}</Text>
          <View className="flex flex-row items-center gap-2">
            <Input
              placeholder={t('searchQuests')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              prefix={SearchIcon}
              suffix={
                <TouchableOpacity
                  onPress={() => setShowDownloadedOnly(!showDownloadedOnly)}
                >
                  <Icon
                    as={FilterIcon}
                    className={cn(
                      'text-muted-foreground',
                      showDownloadedOnly && 'text-primary'
                    )}
                    fill={showDownloadedOnly ? 'currentColor' : 'none'}
                  />
                </TouchableOpacity>
              }
              suffixStyling={false}
              prefixStyling={false}
              size="sm"
            />
          </View>
        </View>

        <LegendList
          key={`${showDownloadedOnly ? 'downloaded' : 'all'}-${dimensions.width}`}
          data={filteredQuests}
          numColumns={
            dimensions.width > 768 && filteredQuests.length > 1 ? 2 : 1
          }
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ paddingBottom: filteredQuests.length * 12 }}
          keyExtractor={(item) => item.id}
          maintainVisibleContentPosition
          recycleItems
          renderItem={({ item }) => (
            <QuestListItem
              quest={item}
              className={cn(dimensions.width > 768 && 'h-[145px]')}
            />
          )}
          estimatedItemSize={175}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() =>
            isFetchingNextPage ? (
              <View className="items-center py-4">
                <ActivityIndicator size="small" className="text-primary" />
              </View>
            ) : null
          }
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center py-16">
              <Text className="text-muted-foreground">
                {debouncedSearchQuery
                  ? t('noQuestsFound')
                  : t('noQuestsAvailable')}
              </Text>
            </View>
          )}
        />

        {/* Floating action buttons */}
        {/* <View style={{ bottom: 0, right: 24 }} className="absolute">
        <View className="flex flex-row gap-2">
          {canManageProject && (
            <Button
              onPress={() => setShowSettingsModal(true)}
              size="icon"
              variant="outline"
            >
              <Icon as={SettingsIcon} size={22} strokeWidth={2.5} />
            </Button>
          )}

          <Button
            onPress={() => setShowProjectDetails(true)}
            // className="h-14 w-14 items-center justify-center rounded-full bg-input shadow"
            size="icon"
            variant="outline"
          >
            <Icon as={InfoIcon} size={22} strokeWidth={2.5} />
          </Button>

          <Button
            onPress={() => setShowMembershipModal(true)}
            // className="h-14 w-14 items-center justify-center rounded-full bg-primary shadow"
            size="icon"
          >
            <Icon as={UsersIcon} size={22} strokeWidth={2.5} />
          </Button>
        </View>
      </View> */}

        <View style={{ bottom: 24, right: 24 }} className="absolute z-50">
          <SpeedDial>
            <SpeedDialItems>
              {canCreateQuestNow && (
                <SpeedDialItem
                  icon={PlusIcon}
                  variant="outline"
                  onPress={() => {
                    if (isCreateOpen) {
                      if (Platform.OS !== 'web')
                        bottomSheetRef.current?.dismiss();
                      setIsCreateOpen(false);
                    } else {
                      if (Platform.OS !== 'web')
                        bottomSheetRef.current?.present();
                      setIsCreateOpen(true);
                    }
                  }}
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
              <SpeedDialItem
                icon={UsersIcon}
                variant="outline"
                onPress={() => setShowMembershipModal(true)}
              />
              <SpeedDialItem
                icon={InfoIcon}
                variant="outline"
                onPress={() => setShowProjectDetails(true)}
              />
            </SpeedDialItems>
            <SpeedDialTrigger />
          </SpeedDial>
        </View>

        {/* Membership Modal */}
        <ProjectMembershipModal
          isVisible={showMembershipModal}
          onClose={() => setShowMembershipModal(false)}
          projectId={currentProjectId || ''}
        />

        {/* Project Details Modal */}
        {showProjectDetails && currentProject && (
          <ModalDetails
            isVisible={showProjectDetails}
            content={currentProject}
            contentType="project"
            onClose={() => setShowProjectDetails(false)}
          />
        )}

        {/* Settings Modal - Only for owners */}
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
            recordId={currentProjectId}
            creatorId={currentProject?.creator_id ?? undefined}
            recordTable="projects"
            hasAlreadyReported={hasReported}
            onReportSubmitted={() => null}
          />
        )}
        {/* Create Quest Bottom Sheet */}
        <BottomSheetModal
          ref={bottomSheetRef}
          index={-1}
          open={isCreateOpen}
          snapPoints={['60%']}
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
                <View className="flex flex-row items-center justify-between">
                  <Text className="mt-2 text-lg font-semibold">
                    {t('newQuest')}
                  </Text>

                  <Button
                    variant="outline"
                    onPress={() => setIsCreateOpen(!isCreateOpen)}
                  >
                    <Icon as={XIcon} size={22} strokeWidth={2.5} />
                  </Button>
                </View>

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
                          prefix={PlusIcon}
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

                <Button
                  disabled={isCreatingQuest}
                  onPress={form.handleSubmit((values) => createQuest(values))}
                >
                  <Text className="text-sm font-medium text-primary-foreground">
                    {t('createObject')}
                  </Text>
                </Button>
              </View>
            </Form>
          </BottomSheetView>
        </BottomSheetModal>
      </View>
    </BottomSheetModalProvider>
  );
}
