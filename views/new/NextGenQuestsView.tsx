// TODO: user can make a sub-quest with the current quest as parentId
// todo: need to query/render any quests that have current quest as parentId

import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useDebouncedState } from '@/hooks/use-debounced-state';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useHasUserReported } from '@/hooks/useReports';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { mergeQuery, resolveTable } from '@/utils/dbUtils';
import { cn, getThemeColor } from '@/utils/styleUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { LegendList } from '@legendapp/list';
import { useMutation } from '@tanstack/react-query';
import { and, eq, isNull, like, or } from 'drizzle-orm';
import {
  FilterIcon,
  FlagIcon,
  FolderPenIcon,
  InfoIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { z } from 'zod';
import { QuestListItem } from './QuestListItem';
import type { HybridDataSource } from './useHybridData';
import { useSimpleHybridInfiniteData } from './useHybridData';

type Quest = typeof quest.$inferSelect;

export default function NextGenQuestsView() {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const { currentProjectId } = useAppNavigation();
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

  const { project: currentProject } = useProjectById(currentProjectId);

  // Create Quest bottom sheet state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [parentForNewQuest, setParentForNewQuest] = useState<string | null>(
    null
  );

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
  } = useSimpleHybridInfiniteData(
    'quests',
    [currentProjectId || '', debouncedSearchQuery],
    // Offline query function
    async ({ pageParam, pageSize }) => {
      if (!currentProjectId) return [];

      const offset = pageParam * pageSize;

      // Build where conditions
      const baseCondition = eq(quest.project_id, currentProjectId);
      const topLevelOnly = isNull(quest.parent_id);

      const conditions = [
        baseCondition,
        topLevelOnly,
        debouncedSearchQuery.trim() &&
          or(
            like(quest.name, `%${debouncedSearchQuery.trim()}%`),
            like(quest.description, `%${debouncedSearchQuery.trim()}%`)
          ),
        !showInvisibleContent && eq(quest.visible, true)
      ];
      // Add search filtering for offline
      const whereConditions = and(...conditions.filter(Boolean));

      const quests = await mergeQuery(
        system.db.query.quest.findMany({
          where: whereConditions,
          limit: pageSize,
          offset
        })
      );

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
        .eq('project_id', currentProjectId)
        .is('parent_id', null);

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
    const questMap = new Map<string, Quest & { source?: HybridDataSource }>();
    allQuests.forEach((quest) => {
      // Prioritize offline data over cloud data for duplicates
      const existingQuest = questMap.get(quest.id);
      if (
        !existingQuest ||
        (quest.source !== 'cloud' && existingQuest.source === 'cloud')
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

      await system.db
        .insert(resolveTable('quest', { localOverride: true }))
        .values({
          name: values.name.trim(),
          description: values.description?.trim(),
          project_id: currentProjectId,
          creator_id: currentUser.id,
          download_profiles: [currentUser.id],
          ...(parentForNewQuest && { parent_id: parentForNewQuest })
        });
    },
    onSuccess: () => {
      form.reset();
      setIsCreateOpen(false);
      setParentForNewQuest(null);
      void refetch();
    },
    onError: (error) => {
      console.error('Failed to create quest', error);
    }
  });

  // Speed dial items are composed inline below

  if (!currentProjectId) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text>{t('noProjectSelected')}</Text>
      </View>
    );
  }

  const filteredQuests = quests.filter((quest) =>
    showDownloadedOnly ? quest.source !== 'cloud' : true
  );

  return (
    <Drawer
      open={isCreateOpen}
      onOpenChange={setIsCreateOpen}
      dismissible={!isCreatingQuest}
    >
      <View className="flex flex-1 flex-col gap-6 p-6 pb-0">
        <View className="flex flex-col gap-4">
          <Text className="text-xl font-semibold">{t('quests')}</Text>
          <View className="flex flex-row items-center gap-2">
            <Input
              placeholder={t('searchQuests')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              prefix={SearchIcon}
              className="flex-1"
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
            {canCreateQuestNow && (
              <DrawerTrigger className={buttonVariants({ size: 'icon-lg' })}>
                <Icon as={PlusIcon} />
              </DrawerTrigger>
            )}
          </View>
        </View>

        {isLoading && !searchQuery ? (
          <ProjectListSkeleton />
        ) : (
          <LegendList
            key={`${showDownloadedOnly ? 'downloaded' : 'all'}-${dimensions.width}`}
            data={filteredQuests}
            numColumns={
              dimensions.width > 768 && filteredQuests.length > 1 ? 2 : 1
            }
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{
              paddingBottom: filteredQuests.length * 12
            }}
            keyExtractor={(item) => item.id}
            maintainVisibleContentPosition
            recycleItems
            renderItem={({ item }) => (
              <QuestListItem
                quest={item}
                className={cn(dimensions.width > 768 && 'h-[145px]')}
                onAddSubquest={(q) => {
                  setParentForNewQuest(q.id);
                  setIsCreateOpen(true);
                }}
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
              <View className="flex-1 flex-col items-center justify-center gap-4 py-16">
                <Text className="text-muted-foreground">
                  {debouncedSearchQuery
                    ? t('noQuestsFound')
                    : t('noQuestsAvailable')}
                </Text>
                {canCreateQuestNow && (
                  <DrawerTrigger className={buttonVariants({ size: 'lg' })}>
                    <Text>{t('createObject')}</Text>
                  </DrawerTrigger>
                )}
              </View>
            )}
          />
        )}

        <View style={{ bottom: 24, right: 24 }} className="absolute">
          <SpeedDial>
            <SpeedDialItems>
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

        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('newQuest')}</DrawerTitle>
          </DrawerHeader>
          <Form {...form}>
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
            </View>
          </Form>
          <DrawerFooter>
            <Button
              onPress={form.handleSubmit((data) => createQuest(data))}
              disabled={isCreatingQuest}
              className="flex-row items-center gap-2"
            >
              {isCreatingQuest && (
                <ActivityIndicator
                  size="small"
                  color={getThemeColor('secondary')}
                />
              )}
              <Text>{t('createObject')}</Text>
            </Button>
            <DrawerClose
              className={buttonVariants({ variant: 'outline' })}
              disabled={isCreatingQuest}
            >
              <Text>Cancel</Text>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
        {/* Create Quest Bottom Sheet */}
        {/* <BottomSheetModal
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
                          prefix={FolderPenIcon}
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
        </BottomSheetModal> */}
      </View>
    </Drawer>
  );
}
