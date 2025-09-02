import { ProjectDetails } from '@/components/ProjectDetails';
import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import { project, quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { DraftProject } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { BIBLE_TEMPLATE } from '@/utils/projectTemplates';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { FlashList } from '@shopify/flash-list';
import { and, eq, like, or } from 'drizzle-orm';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { QuestListItem } from './QuestListItem';
import { useHybridData, useSimpleHybridInfiniteData } from './useHybridData';

type Quest = typeof quest.$inferSelect;
type Project = typeof project.$inferSelect;
type ProjectOrDraft = Project | DraftProject;

// Helper function to safely get creator_id from either project type
const getCreatorId = (project: ProjectOrDraft): string | null => {
  if ('creator_id' in project) {
    return project.creator_id || null;
  }
  return null;
};

export default function NextGenQuestsView() {
  const { t } = useLocalization();
  const { currentProjectId } = useCurrentNavigation();
  const [showMembershipModal, setShowMembershipModal] = React.useState(false);
  const [showProjectDetails, setShowProjectDetails] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('');
  const [showDownloadedOnly, setShowDownloadedOnly] = React.useState(false);

  // Debounce the search query
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Check user permissions for settings cog visibility
  const { hasAccess: canManageProject } = useUserPermissions(
    currentProjectId || '',
    'project_settings_cog'
  );

  // Fetch current project data
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

  // Get draft project data for optimistic rendering when project data is still loading
  const draftProjects = useLocalStore((state) => state.draftProjects);
  const currentDraftProject = React.useMemo(() => {
    if (!currentProjectId) return null;
    return draftProjects.find((dp) => dp.id === currentProjectId) || null;
  }, [currentProjectId, draftProjects]);

  // Optimistic virtual quests from local template knowledge for fast-first paint
  const optimisticVirtualQuests = React.useMemo(() => {
    // Use draft project data if available, otherwise use loaded project data
    const projectToUse = currentProject || currentDraftProject;

    if (!projectToUse?.templates?.includes('every-language-bible')) return [];

    // Generate only what we need for the first paint to avoid heavy work on navigation
    const FIRST_PAGE_SIZE = 40; // render the first N only; more will stream via list/infinite data
    const v = BIBLE_TEMPLATE.createQuests(projectToUse.source_language_id)
      .slice(0, FIRST_PAGE_SIZE)
      .map((qt) => ({
        id: `virtual_${qt.name}`,
        name: qt.name,
        description: qt.description ?? null,
        project_id: projectToUse.id,
        creator_id: getCreatorId(projectToUse),
        visible: qt.visible,
        active: true,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        download_profiles: null,
        source: 'localSqlite'
      }));

    // Apply search filtering early
    const query = debouncedSearchQuery.trim().toLowerCase();
    const filtered = query
      ? v.filter(
          (q) =>
            (q.name || '').toLowerCase().includes(query) ||
            (q.description ?? '').toLowerCase().includes(query)
        )
      : v;

    // Do not sort here; leave ordering to FlashList stability and offline query to save CPU on nav
    return filtered;
  }, [
    currentProject?.id,
    currentProject?.templates,
    currentProject?.source_language_id,
    currentProject?.creator_id,
    currentDraftProject?.id,
    currentDraftProject?.templates,
    currentDraftProject?.source_language_id,
    currentDraftProject?.creator_id,
    debouncedSearchQuery
  ]);

  // Draft quests from local store (created during draft flows), keyed by project
  const draftQuests = useLocalStore((state) => state.draftQuests);
  const optimisticLocalDraftQuests = React.useMemo(() => {
    // Use draft project data if available, otherwise use loaded project data
    const projectToUse = currentProject || currentDraftProject;
    if (!projectToUse?.id) return [];

    const drafts = draftQuests
      .filter((dq) => dq.project_id === projectToUse.id)
      .map((dq) => ({
        id: dq.id,
        name: dq.name,
        description: dq.description ?? null,
        project_id: projectToUse.id,
        creator_id: getCreatorId(projectToUse),
        visible: dq.visible,
        active: true,
        created_at: dq.created_at.toISOString(),
        last_updated: dq.last_updated.toISOString(),
        download_profiles: null,
        source: 'localDraft'
      }));

    // Apply search filtering to drafts
    const query = debouncedSearchQuery.trim().toLowerCase();
    const filtered = query
      ? drafts.filter(
          (q) =>
            (q.name || '').toLowerCase().includes(query) ||
            (q.description ?? '').toLowerCase().includes(query)
        )
      : drafts;

    // Sort
    filtered.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    );
    return filtered;
  }, [
    currentProject?.id,
    currentProject?.creator_id,
    currentDraftProject?.id,
    currentDraftProject?.creator_id,
    draftQuests,
    debouncedSearchQuery
  ]);
  const currentStatus = useStatusContext();
  currentStatus.layerStatus(LayerType.PROJECT, currentProjectId || '');
  const { showInvisibleContent } = currentStatus;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isOnline,
    isFetching
  } = useSimpleHybridInfiniteData<Quest>(
    'quests',
    [currentProjectId || '', debouncedSearchQuery], // Use debounced search query
    // Offline query function
    async ({ pageParam, pageSize }) => {
      if (!currentProjectId) return [];

      const offset = pageParam * pageSize;

      // Build where conditions
      const baseCondition = eq(quest.project_id, currentProjectId);

      // Add search filtering for offline
      const whereConditions = and(
        baseCondition,
        debouncedSearchQuery.trim()
          ? or(
              like(quest.name, `%${debouncedSearchQuery}%`),
              like(quest.description, `%${debouncedSearchQuery}%`)
            )
          : undefined,
        !showInvisibleContent ? eq(quest.visible, true) : undefined
      );

      // Default paginated fetch
      let quests = await system.db.query.quest.findMany({
        where: whereConditions,
        limit: pageSize,
        offset
      });

      // For templated projects, build a full combined list (materialized + virtual) and then slice by offset/pageSize
      const projectToUse = currentProject || currentDraftProject;
      if (projectToUse?.templates?.includes('every-language-bible')) {
        // Fetch all materialized quests for this project (for dedup + ordering)
        const allMaterialized = await system.db.query.quest.findMany({
          where: baseCondition
        });

        // Apply search filter to materialized as well to keep ordering consistent
        const filteredMaterialized = debouncedSearchQuery.trim()
          ? allMaterialized.filter(
              (q) =>
                (q.name || '')
                  .toLowerCase()
                  .includes(debouncedSearchQuery.trim().toLowerCase()) ||
                (q.description ?? '')
                  .toLowerCase()
                  .includes(debouncedSearchQuery.trim().toLowerCase())
            )
          : allMaterialized;

        // Generate template virtual quests and filter
        const templateQuests = BIBLE_TEMPLATE.createQuests(
          projectToUse.source_language_id
        ).map((qt) => ({
          id: `virtual_${qt.name}`,
          name: qt.name,
          description: qt.description ?? null,
          project_id: currentProjectId,
          creator_id: getCreatorId(projectToUse),
          visible: qt.visible,
          active: true,
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          download_profiles: null,
          source: 'localSqlite'
        }));

        const existingNames = new Set(filteredMaterialized.map((q) => q.name));
        const virtuals = templateQuests.filter(
          (tq) => !existingNames.has(tq.name)
        );
        const filteredVirtuals = debouncedSearchQuery.trim()
          ? virtuals.filter(
              (v) =>
                (v.name || '')
                  .toLowerCase()
                  .includes(debouncedSearchQuery.trim().toLowerCase()) ||
                (v.description ?? '')
                  .toLowerCase()
                  .includes(debouncedSearchQuery.trim().toLowerCase())
            )
          : virtuals;

        // Combine full list and sort naturally once
        const combinedFull = [
          ...filteredMaterialized,
          ...filteredVirtuals
        ].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: 'base'
          })
        );

        // Slice by offset/pageSize for this page
        quests = combinedFull.slice(offset, offset + pageSize);
      }

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
          `name.ilike.%${debouncedSearchQuery}%,description.ilike.%${debouncedSearchQuery}%`
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

  // Flatten pages; preserve ordering from pages (already sorted in offline query)
  const quests = React.useMemo(() => {
    const allQuests = data.pages.flatMap((page) => page.data);
    return allQuests;
  }, [data.pages]);

  // Filter quests based on download status
  const filteredQuests = React.useMemo(() => {
    if (showDownloadedOnly) {
      return quests.filter((quest) => quest.source === 'localSqlite');
    }
    return quests;
  }, [quests, showDownloadedOnly]);

  const renderItem = React.useCallback(
    ({ item }: { item: Quest & { source?: string } }) => (
      <QuestListItem quest={item} />
    ),
    []
  );

  const keyExtractor = React.useCallback(
    (item: Quest & { source?: string }) => item.id,
    []
  );

  const onEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderFooter = React.useCallback(() => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage]);

  const statusText = React.useMemo(() => {
    const downloadedCount = quests.filter(
      (q) => q.source === 'localSqlite'
    ).length;
    const cloudCount = quests.filter(
      (q) => q.source === 'cloudSupabase'
    ).length;

    return `${isOnline ? '🟢' : '🔴'} Available: ${downloadedCount} | Needs Download: ${cloudCount} | Total: ${quests.length}`;
  }, [isOnline, quests]);

  if (
    isLoading &&
    !searchQuery &&
    optimisticVirtualQuests.length === 0 &&
    optimisticLocalDraftQuests.length === 0
  ) {
    return <ProjectListSkeleton />;
  }

  if (!currentProjectId) {
    return (
      <View style={sharedStyles.container}>
        <Text style={sharedStyles.title}>{t('noProjectSelected')}</Text>
      </View>
    );
  }

  return (
    <View style={sharedStyles.container}>
      <Text style={sharedStyles.title}>{t('quests')}</Text>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('search')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textSecondary}
        />
        <View style={styles.searchIconContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
        </View>
        {/* Show loading indicator in search bar when searching */}
        {isFetching && searchQuery && (
          <View style={styles.searchLoadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
        <TouchableOpacity
          style={[styles.filterButton]}
          onPress={() => setShowDownloadedOnly(!showDownloadedOnly)}
        >
          <Ionicons
            size={20}
            name={showDownloadedOnly ? 'funnel' : 'funnel-outline'}
            color={colors.text}
            style={{ zIndex: 1 }}
          />
          {showDownloadedOnly && (
            <>
              {/* This first icon is to put the icon background white */}
              <Ionicons
                size={16}
                name="ellipse"
                style={[styles.backgroundBox]}
                color={colors.text}
              />
              <Ionicons
                size={16}
                name="checkmark-circle"
                style={[styles.checkIcon]}
                color={colors.primary}
              />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
      {SHOW_DEV_ELEMENTS && (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSizes.small,
            marginBottom: spacing.small
          }}
        >
          {statusText}
        </Text>
      )}

      {/* Show skeleton only on initial load, not during search */}
      {isLoading && searchQuery ? (
        <View style={styles.searchingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.searchingText}>{t('searching')}</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlashList
            data={
              isLoading &&
              (optimisticVirtualQuests.length > 0 ||
                optimisticLocalDraftQuests.length > 0)
                ? [...optimisticLocalDraftQuests, ...optimisticVirtualQuests]
                : filteredQuests
            }
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery ? t('noQuestsFound') : t('noQuestsAvailable')}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Floating action buttons */}
      <View style={styles.floatingButtonContainer}>
        <View style={styles.floatingButtonRow}>
          {/* Settings Button - Only visible to owners */}
          {canManageProject && (
            <TouchableOpacity
              onPress={() => setShowSettingsModal(true)}
              style={[styles.floatingButton, styles.secondaryFloatingButton]}
            >
              <Ionicons name="settings" size={24} color={colors.text} />
            </TouchableOpacity>
          )}

          {/* Project Details Button */}
          <TouchableOpacity
            onPress={() => setShowProjectDetails(true)}
            style={[styles.floatingButton, styles.secondaryFloatingButton]}
          >
            <Ionicons name="information-circle" size={24} color={colors.text} />
          </TouchableOpacity>

          {/* Membership Button */}
          <TouchableOpacity
            onPress={() => setShowMembershipModal(true)}
            style={styles.floatingButton}
          >
            <Ionicons name="people" size={24} color={colors.text} />
          </TouchableOpacity>
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

export const styles = StyleSheet.create({
  listContainer: {
    paddingVertical: spacing.small
  },
  listItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.medium,
    marginBottom: spacing.small,
    gap: spacing.xsmall
  },
  questName: {
    color: colors.text,
    fontSize: fontSizes.large,
    fontWeight: 'bold'
  },
  description: {
    color: colors.text,
    fontSize: fontSizes.medium,
    opacity: 0.8
  },
  loadingFooter: {
    paddingVertical: spacing.medium,
    alignItems: 'center'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium,
    position: 'relative',
    gap: spacing.small
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    paddingLeft: 40, // Make room for search icon
    color: colors.text,
    fontSize: fontSizes.medium
  },
  searchIconContainer: {
    position: 'absolute',
    left: spacing.small,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30
  },
  floatingButton: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: spacing.large,
    right: spacing.large,
    gap: spacing.small
  },
  floatingButtonRow: {
    flexDirection: 'row',
    gap: spacing.small
  },
  secondaryFloatingButton: {
    backgroundColor: colors.inputBackground
  },
  settingsFloatingButton: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  searchLoadingContainer: {
    position: 'absolute',
    right: spacing.small,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30
  },
  searchingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xlarge
  },
  searchingText: {
    marginTop: spacing.medium,
    color: colors.textSecondary,
    fontSize: fontSizes.medium
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xlarge
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSizes.medium
  },
  filterButton: {
    position: 'absolute',
    right: spacing.small,
    padding: spacing.small,
    borderRadius: borderRadius.small
  },
  backgroundBox: {
    position: 'absolute',
    padding: 2,
    borderRadius: borderRadius.small,
    right: 0,
    zIndex: 1000
  },
  checkIcon: {
    position: 'absolute',
    padding: 2,
    borderRadius: borderRadius.small,
    right: 0,
    zIndex: 1000
  }
});
