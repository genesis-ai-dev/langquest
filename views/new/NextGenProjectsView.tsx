import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import { profile_project_link, project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useUserRestrictions } from '@/hooks/db/useBlocks';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { FlashList } from '@shopify/flash-list';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { ProjectListItem } from './ProjectListItem';
import { useSimpleHybridInfiniteData } from './useHybridData';

type Project = typeof project.$inferSelect;

type TabType = 'my' | 'all';

export default function NextGenProjectsView() {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showDownloadedOnly] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabType>('my');

  const userId = currentUser?.id;

  // Clean Status Navigation
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
  const myProjectsQuery = useSimpleHybridInfiniteData<Project>(
    'my-projects',
    [userId || ''], // Include userId in query key
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
        !showInvisibleContent ? eq(project.visible, true) : undefined
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
      const { data, error } = await query.overrideTypes<Project[]>();

      if (error) throw error;
      return data;
    },
    20 // pageSize
  );

  // Query for All Projects (excluding user's projects)
  const allProjectsQuery = useSimpleHybridInfiniteData<Project>(
    'all-projects',
    [userId || ''], // Include userId in query key
    // Offline query function
    async ({ pageParam, pageSize }) => {
      const offset = pageParam * pageSize;

      if (userId) {
        // Get projects where user is a member
        const userProjectLinks = await system.db
          .select()
          .from(profile_project_link)
          .where(
            and(
              eq(profile_project_link.profile_id, userId),
              eq(profile_project_link.active, true)
            )
          );

        const userProjectIds = userProjectLinks.map((link) => link.project_id);

        const conditions = [
          userProjectIds.length > 0
            ? notInArray(project.id, userProjectIds)
            : undefined,
          !showInvisibleContent ? eq(project.visible, true) : undefined,
          blockUserIds.length > 0
            ? notInArray(project.creator_id, blockUserIds)
            : undefined,
          blockContentIds.length > 0
            ? notInArray(project.id, blockContentIds)
            : undefined
        ];

        // Get all active projects excluding user's projects
        const projects = await system.db.query.project.findMany({
          where: and(...conditions.filter(Boolean)),
          limit: pageSize,
          offset
        });

        return projects;
      } else {
        // If no user, show all active projects
        const projects = await system.db.query.project.findMany({
          where: eq(project.active, true),
          limit: pageSize,
          offset
        });
        return projects;
      }
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

      const { data, error } = await query
        .range(from, to)
        .overrideTypes<Project[]>();

      if (error) throw error;
      return data;
    },
    20 // pageSize
  );

  // Use the appropriate query based on active tab
  const currentQuery = activeTab === 'my' ? myProjectsQuery : allProjectsQuery;
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isOnline
  } = currentQuery;

  // Flatten all pages into a single array
  const projects = React.useMemo(() => {
    return data.pages.flatMap((page) => page.data);
  }, [data.pages]);

  // Filter projects based on search query
  const filteredProjects = React.useMemo(() => {
    let filtered = projects;

    // Filter by download status if enabled
    if (showDownloadedOnly) {
      filtered = filtered.filter((project) => project.source === 'localSqlite');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((project) => {
        const nameMatch = project.name.toLowerCase().includes(query);
        const descriptionMatch =
          project.description?.toLowerCase().includes(query) ?? false;
        return nameMatch || descriptionMatch;
      });
    }

    return filtered;
  }, [projects, searchQuery, showDownloadedOnly]);

  const renderItem = React.useCallback(
    ({ item }: { item: Project & { source?: string } }) => (
      <ProjectListItem project={item} />
    ),
    []
  );

  const keyExtractor = React.useCallback(
    (item: Project & { source?: string }) => item.id,
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
    const offlineCount = projects.filter(
      (p) => p.source === 'localSqlite'
    ).length;
    const cloudCount = projects.filter(
      (p) => p.source === 'cloudSupabase'
    ).length;
    return `${isOnline ? '🟢' : '🔴'} Offline: ${offlineCount} | Cloud: ${isOnline ? cloudCount : 'N/A'} | Total: ${projects.length}`;
  }, [isOnline, projects]);

  if (isLoading) {
    return <ProjectListSkeleton />;
  }

  return (
    <View style={sharedStyles.container}>
      <Text style={sharedStyles.title}>{t('projects')}</Text>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'my' && styles.activeTab]}
          onPress={() => setActiveTab('my')}
        >
          <Text
            style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}
          >
            {t('myProjects')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'all' && styles.activeTabText
            ]}
          >
            {t('allProjects')}
          </Text>
        </Pressable>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={
            activeTab === 'my' ? t('searchMyProjects') : t('searchAllProjects')
          }
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textSecondary}
        />
        {/* <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowDownloadedOnly(!showDownloadedOnly)}
        >
          <Ionicons
            name={showDownloadedOnly ? 'filter' : 'filter-outline'}
            size={20}
            color={showDownloadedOnly ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity> */}
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

      <FlashList
        data={filteredProjects}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        extraData={activeTab} // Re-render when tab changes
      />
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
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  projectName: {
    color: colors.text,
    fontSize: fontSizes.large,
    fontWeight: 'bold'
  },
  languagePair: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
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
    marginBottom: spacing.medium,
    flexDirection: 'row',
    alignItems: 'center'
  },
  searchInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    color: colors.text,
    fontSize: fontSizes.medium,
    flex: 1
  },
  filterButton: {
    paddingHorizontal: spacing.small
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 4,
    marginBottom: spacing.medium
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 6,
    alignItems: 'center'
  },
  activeTab: {
    backgroundColor: colors.primary
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: fontSizes.medium,
    fontWeight: '500'
  },
  activeTabText: {
    color: colors.buttonText,
    fontWeight: '600'
  }
});
