import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { Project } from '@/database_services/projectService';
import { profile_project_link, project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useSimpleHybridInfiniteData } from '@/views/new/useHybridData';
import { LegendList } from '@legendapp/list';
import { and, eq, inArray, like, notInArray, or } from 'drizzle-orm';
import { SearchIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { ProjectListItem } from './ProjectListItem';

type TabType = 'my' | 'all';

export default function NextGenProjectsView() {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<TabType>('my');

  //   // Clean Status Navigation
  const currentContext = useStatusContext();
  currentContext.setLayerStatus(
    LayerType.PROJECT,
    { active: true, visible: true },
    ''
  );
  const showInvisibleContent = currentContext.showInvisibleContent;

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
      // .eq('active', true);

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

  return (
    <View className="flex flex-col gap-6 p-6">
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
        </View>
      </View>

      {isLoading ? (
        <ProjectListSkeleton />
      ) : (
        <LegendList
          data={data}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ paddingBottom: data.length * 12 }}
          keyExtractor={(item) => item.id}
          recycleItems
          renderItem={({ item }) => <ProjectListItem project={item} />}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}
