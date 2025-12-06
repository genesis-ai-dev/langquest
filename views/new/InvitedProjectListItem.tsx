import type { invite } from '@/db/drizzleSchema';
import { project as projectTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { Project } from '@/hooks/db/useProjects';
import { useThemeColor } from '@/utils/styleUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { eq } from 'drizzle-orm';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ProjectListItem } from './ProjectListItem';

type Invite = typeof invite.$inferSelect;

export function InvitedProjectListItem({
  projectId,
  className,
  searchQuery
}: {
  projectId: string;
  className?: string;
  searchQuery?: string;
}) {
  // Fetch project data via cloud query only
  const { data: projectData, isLoading } = useHybridData({
    dataType: 'invited-project-data',
    queryKeyParams: [projectId],
    offlineQuery: toCompilableQuery(
      system.db.query.project.findFirst({
        where: eq(projectTable.id, projectId)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('*')
        .eq('id', projectId)
        .overrideTypes<Project[]>();
      if (error) throw error;
      return data;
    },
    enableOfflineQuery: false
  });

  const project = projectData[0];

  const primaryColor = useThemeColor('primary');

  if (isLoading) {
    return (
      <View className={className}>
        <View className="h-[175px] items-center justify-center rounded-lg border border-border bg-card">
          <ActivityIndicator size="small" color={primaryColor} />
        </View>
      </View>
    );
  }

  if (!project) {
    return null; // Project doesn't exist or user doesn't have access
  }

  // Filter by search query if provided
  if (searchQuery) {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return null; // Empty search query
    const matchesName = project.name.toLowerCase().includes(trimmed);
    const matchesDescription =
      project.description?.toLowerCase().includes(trimmed) ?? false;
    if (!matchesName && !matchesDescription) {
      return null; // Doesn't match search query
    }
  }

  return (
    <ProjectListItem
      project={{ ...project, source: 'cloud' }}
      isInvited={true}
      className={className}
    />
  );
}
