import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { system } from '@/db/powersync/system';
import type { Project } from '@/hooks/db/useProjects';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProjectListItem } from './ProjectListItem';

function useNextGenLocalProjects() {
  return useQuery({
    queryKey: ['projects', 'offline'],
    queryFn: async () => {
      const projects = await system.db.query.project.findMany({
        where: (fields, { eq, and }) => and(eq(fields.active, true))
      });
      return projects.map((project) => ({
        ...project,
        source: 'localSqlite'
      }));
    }
  });
}

function useNextGenCloudProjects(isOnline: boolean) {
  return useQuery({
    queryKey: ['projects', 'cloud'],
    queryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('*')
        .eq('active', true)
        .overrideTypes<Project[]>();
      if (error) throw error;
      return data.map((project) => ({
        ...project,
        source: 'cloudSupabase'
      }));
    },
    enabled: isOnline // Only run when online
  });
}

export default function NextGenProjectsView() {
  const isOnline = useNetworkStatus();
  const { data: offlineProjects, isLoading: isOfflineLoading } =
    useNextGenLocalProjects();
  const {
    data: cloudProjects,
    isLoading: isCloudLoading,
    error: cloudError
  } = useNextGenCloudProjects(isOnline);

  // Combine projects with cloud taking precedence for duplicates
  const projects = React.useMemo(() => {
    const offlineProjectsArray = offlineProjects || [];
    const cloudProjectsArray = cloudProjects || [];

    // Create a map of offline projects by ID for quick lookup
    const offlineProjectMap = new Map(
      offlineProjectsArray.map((project) => [project.id, project])
    );

    // Add cloud projects that don't exist in offline
    const uniqueCloudProjects = cloudProjectsArray.filter(
      (project) => !offlineProjectMap.has(project.id)
    );

    // Return cloud projects first, then unique offline projects
    return [...offlineProjectsArray, ...uniqueCloudProjects];
  }, [offlineProjects, cloudProjects]);

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

  if (isOfflineLoading || isCloudLoading) {
    return <ProjectListSkeleton />;
  }

  return (
    <View style={sharedStyles.container}>
      <Text style={sharedStyles.title}>All Projects</Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSizes.small,
          marginBottom: spacing.small
        }}
      >
        {cloudError && (
          <Text style={{ color: colors.error }}>
            Cloud Error: {cloudError.message}
          </Text>
        )}
      </Text>
      <FlashList
        data={projects}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={80}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
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
  }
});
