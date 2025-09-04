import { ProjectDetails } from '@/components/ProjectDetails';
import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import { project, quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useDebouncedState } from '@/hooks/use-debounced-state';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/utils/styleUtils';
import { LegendList } from '@legendapp/list';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, like, or } from 'drizzle-orm';
import {
  FilterIcon,
  InfoIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { QuestListItem } from './QuestListItem';
import { useHybridData, useSimpleHybridInfiniteData } from './useHybridData';

type Quest = typeof quest.$inferSelect;
type Project = typeof project.$inferSelect;

export default function NextGenQuestsView() {
  const { t } = useLocalization();
  const { currentProjectId } = useCurrentNavigation();
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
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

  const currentStatus = useStatusContext();
  currentStatus.layerStatus(LayerType.PROJECT, currentProjectId || '');
  const { showInvisibleContent } = currentStatus;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useSimpleHybridInfiniteData<Quest>(
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
    <View className="relative flex flex-1 flex-col gap-6 p-6">
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
        data={filteredQuests}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ paddingBottom: filteredQuests.length * 12 }}
        keyExtractor={(item) => item.id}
        recycleItems
        renderItem={({ item }) => <QuestListItem quest={item} />}
        showsVerticalScrollIndicator={false}
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
      <View style={{ bottom: 0, right: 24 }} className="absolute">
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
      </View>

      {/* Membership Modal */}
      <ProjectMembershipModal
        isVisible={showMembershipModal}
        onClose={() => setShowMembershipModal(false)}
        projectId={currentProjectId || ''}
      />

      {/* Project Details Modal */}
      {showProjectDetails && currentProject && (
        <ProjectDetails
          project={currentProject}
          onClose={() => setShowProjectDetails(false)}
        />
      )}

      {/* Settings Modal - Only for owners */}
      {canManageProject && (
        <ProjectSettingsModal
          isVisible={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          projectId={currentProjectId || ''}
        />
      )}
    </View>
  );
}
