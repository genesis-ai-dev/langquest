import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import type { project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { ProjectListItem } from './ProjectListItem';
import { useSimpleHybridInfiniteData } from './useHybridData';

type Project = typeof project.$inferSelect;

export default function NextGenProjectsView() {
  const { t } = useLocalization();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showDownloadedOnly, setShowDownloadedOnly] = React.useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isOnline
  } = useSimpleHybridInfiniteData<Project>(
    'projects',
    [], // No additional query params needed for projects
    // Offline query function
    async ({ pageParam, pageSize }) => {
      const offset = pageParam * pageSize;
      const projects = await system.db.query.project.findMany({
        where: (fields, { eq, and }) => and(eq(fields.active, true)),
        limit: pageSize,
        offset
      });
      return projects;
    },
    // Cloud query function
    async ({ pageParam, pageSize }) => {
      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('*')
        .eq('active', true)
        .range(from, to)
        .overrideTypes<Project[]>();

      if (error) throw error;
      return data;
    },
    20 // pageSize
  );

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
      <Text style={sharedStyles.title}>{t('allProjects')}</Text>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchProjects')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textSecondary}
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowDownloadedOnly(!showDownloadedOnly)}
        >
          <Ionicons
            name={showDownloadedOnly ? 'filter' : 'filter-outline'}
            size={20}
            color={showDownloadedOnly ? colors.primary : colors.textSecondary}
          />
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
      <FlashList
        data={filteredProjects}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={80}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
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
  }
});
