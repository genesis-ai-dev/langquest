import type { FloatingMenuItem } from '@/components/FloatingMenu';
import { createMenuItem, FloatingMenu } from '@/components/FloatingMenu';
import { ModalDetails } from '@/components/ModalDetails';
import { ReportModal } from '@/components/NewReportModal';
import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { quest } from '@/db/drizzleSchema';
import { project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useInfiniteQuestsByProjectId } from '@/hooks/db/useQuests';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useHasUserReported } from '@/hooks/useReports';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { FlashList } from '@shopify/flash-list';
import { eq } from 'drizzle-orm';
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
import { useHybridData } from './useHybridData';

type Quest = typeof quest.$inferSelect;
type Project = typeof project.$inferSelect;

export default function NextGenQuestsView() {
  const { t } = useLocalization();
  const { currentProjectId } = useCurrentNavigation();
  const [showMembershipModal, setShowMembershipModal] = React.useState(false);
  const [showProjectDetails, setShowProjectDetails] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
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
  const { data: projectData, refetch: refetchProject } = useHybridData<Project>(
    {
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
    }
  );

  const currentProject = projectData[0];

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
  } = useInfiniteQuestsByProjectId(
    currentProjectId,
    debouncedSearchQuery,
    showInvisibleContent
  );

  const {
    hasReported,
    isLoading: isReportLoading
    // refetch: refetchReport
  } = useHasUserReported(currentProjectId || '', 'projects');

  // Flatten all pages into a single array and deduplicate
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

  const menuItems = React.useMemo<FloatingMenuItem[]>(() => {
    const items = [];
    if (canManageProject) {
      items.push(
        createMenuItem('settings', 'Settings', () => setShowSettingsModal(true))
      );
    } else {
      if (!hasReported && !isReportLoading) {
        items.push(
          createMenuItem('flag', 'Report', () => setShowReportModal(true))
        );
      }
    }

    return [
      ...items,
      createMenuItem('people', 'Membership', () =>
        setShowMembershipModal(true)
      ),
      createMenuItem('information-circle', 'Info', () =>
        setShowProjectDetails(true)
      )
    ];
  }, [canManageProject, hasReported, isReportLoading]);

  if (isLoading && !searchQuery) {
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
        <View style={[{ flex: 1 }]}>
          <FlashList
            data={filteredQuests}
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

      <FloatingMenu items={menuItems} />

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
          onReportSubmitted={() => refetchProject()}
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
  floatingReportButton: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    width: 48,
    height: 48,
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
    gap: spacing.small,
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  floatingButtonRow: {
    flexDirection: 'row',
    gap: spacing.small
  },
  floatingButtonRowLeft: {
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
