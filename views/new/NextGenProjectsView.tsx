import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import { profile_project_link, project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { Vote } from '@/hooks/db/useVotes';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { FlashList } from '@shopify/flash-list';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
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

        // Get all active projects excluding user's projects
        if (userProjectIds.length > 0) {
          const projects = await system.db.query.project.findMany({
            where: and(
              // eq(project.active, true),
              notInArray(project.id, userProjectIds)
            ),
            limit: pageSize,
            offset
          });
          return projects;
        } else {
          // If user has no projects, show all active projects
          const projects = await system.db.query.project.findMany({
            where: eq(project.active, true),
            limit: pageSize,
            offset
          });
          return projects;
        }
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

  // RLS Policy Testing Function
  const testRLSPolicies = React.useCallback(async () => {
    if (!userId) {
      Alert.alert('Error', 'Must be logged in to test RLS policies');
      return;
    }

    console.log('Testing RLS policies');
    const results: string[] = [];

    const fakeUserId = 'cfee7714-cebe-409e-950b-ddc48c92d964';

    try {
      // Test 1: Try to create membership for someone else (should FAIL)
      results.push('🔒 TEST 1: Profile Project Link Security');
      const { error: error1 } = await system.supabaseConnector.client
        .from('profile_project_link')
        .insert({
          profile_id: fakeUserId,
          project_id: 'bace07b1-41de-4535-9c68-aa81683d9370',
          membership: 'owner'
        });

      const { data: linkData } = await system.supabaseConnector.client
        .from('profile_project_link')
        .select('*')
        .eq('profile_id', fakeUserId)
        .limit(1);

      if (
        error1?.message.includes('row-level security') ||
        linkData?.length === 0
      ) {
        results.push(
          `✅ SECURE: Cannot create membership for another user! ${error1?.message ?? 'No error message'}`
        );
      } else {
        results.push(
          `❌ SECURITY BREACH: Could create membership for another user!`
        );
      }
      // Test 2: Try to update someone else's vote (should FAIL)
      results.push('\n🔒 TEST 2: Vote Update Security');
      const { error: error2 } = await system.supabaseConnector.client
        .from('vote')
        .update({ polarity: 'down', comment: 'Hacked!' })
        .eq('id', 'aa0e8400-e29b-41d4-a716-446655440003');

      const { data: vote } = await system.supabaseConnector.client
        .from('vote')
        .select('*')
        .eq('id', 'aa0e8400-e29b-41d4-a716-446655440003')
        .limit(1)
        .overrideTypes<Vote[]>();

      console.log('error2', error2);
      if (
        error2?.message.includes('row-level security') ||
        (vote && vote[0]?.polarity !== 'down' && vote[0]?.comment !== 'Hacked!')
      ) {
        results.push(
          `✅ SECURE: Cannot modify another user's vote! ${error2?.message ?? 'No error message'} ${JSON.stringify(vote)}`
        );
      } else {
        results.push("❌ SECURITY BREACH: Could modify another user's vote!");
      }

      // Test 3: Try to create translation as someone else (should FAIL)
      results.push('\n🔒 TEST 3: Translation Creation Security');
      const { error: error3 } = await system.supabaseConnector.client
        .from('translation')
        .insert({
          id: 'd37dc4a4-481c-4bce-a77b-dc2a1ec1ae1d',
          asset_id: '3d7ebf63-ce54-4b8c-8c4b-a1d589ba02b3',
          creator_id: fakeUserId, // Try to impersonate
          text: 'Hacked translation'
        });
      if (error3?.message.includes('row-level security')) {
        results.push(
          `✅ SECURE: Cannot create translation as another user! ${error3.message}`
        );
      } else {
        results.push(
          `❌ SECURITY BREACH: Could create translation as another user!`
        );
      }

      // Test 4: Try to create report as someone else (should FAIL)
      results.push('\n🔒 TEST 4: Report Creation Security');
      const { error: error4 } = await system.supabaseConnector.client
        .from('reports')
        .insert({
          id: '8bcfeaf7-370c-44fb-acd9-dfbb25751fb7',
          record_id: '990e8400-e29b-41d4-a716-446655440003',
          record_table: 'translation',
          reporter_id: fakeUserId, // Try to impersonate
          reason: 'spam',
          details: 'Fake report'
        });
      if (error4?.message.includes('row-level security')) {
        results.push(
          `✅ SECURE: Cannot create report as another user! ${error4.message}`
        );
      } else {
        results.push(
          `❌ SECURITY BREACH: Could create report as another user!`
        );
      }

      // Test 5: Try to create vote as someone else (should FAIL)
      results.push('\n🔒 TEST 5: Vote Creation Security');
      const { error: error5 } = await system.supabaseConnector.client
        .from('vote')
        .insert({
          id: '7c6b3d72-1c12-4f0d-9b07-f2e44d5fa3be',
          translation_id: '990e8400-e29b-41d4-a716-446655440001',
          polarity: 'up',
          creator_id: fakeUserId, // Try to impersonate
          comment: 'Fake vote'
        });
      if (error5?.message.includes('row-level security')) {
        results.push(
          `✅ SECURE: Cannot create vote as another user! ${error5.message}`
        );
      } else {
        results.push('❌ SECURITY BREACH: Could create vote as another user!');
      }

      // Test 6: Project owner should be able to view project invites (should SUCCEED)
      results.push('\n🔒 TEST 6: Project Owner Can View Project Invites');
      const { data: inviteData, error: error6 } =
        await system.supabaseConnector.client
          .from('invite')
          .select('*')
          .eq('receiver_profile_id', 'f2adf435-fd35-4927-8644-9b03785722b5'); // Keean2's invites

      if (error6) {
        results.push(`❌ ERROR: Failed to query invites - ${error6.message}`);
      } else if (inviteData.length > 0) {
        results.push(
          '✅ EXPECTED: Project owner can view invites for their projects'
        );
      } else {
        results.push(
          '❌ UNEXPECTED: Should be able to see project invites as owner'
        );
      }

      // Test 7: Create legitimate content as self (should SUCCEED)
      results.push('\n🔒 TEST 7: Legitimate Operations');
      const { error: error7 } = await system.supabaseConnector.client
        .from('vote')
        .insert({
          id: '6cc13c0b-e18a-4bf7-92b0-8198e2244de0',
          translation_id: '990e8400-e29b-41d4-a716-446655440001',
          polarity: 'up',
          creator_id: userId, // Our own ID
          comment: 'Test vote from RLS test'
        });

      if (error7) {
        results.push(
          `❌ FAILED: Could not create legitimate vote: ${error7.message}`
        );
      } else {
        results.push('✅ SUCCESS: Can create legitimate vote as self');

        // Clean up the test vote
        const { error: cleanupError } = await system.supabaseConnector.client
          .from('vote')
          .delete()
          .eq('id', '6cc13c0b-e18a-4bf7-92b0-8198e2244de0');

        if (cleanupError) {
          results.push(
            `⚠️ WARNING: Could not clean up test vote: ${cleanupError.message}`
          );
        }
      }

      // Test 8: Update our own content (should SUCCEED)
      results.push('\n🔒 TEST 8: Update Own Content');
      const { data: ourVotes, error: error8a } =
        await system.supabaseConnector.client
          .from('vote')
          .select('*')
          .eq('creator_id', userId)
          .limit(1);

      if (error8a) {
        results.push(
          `❌ FAILED: Could not query own votes: ${error8a.message}`
        );
      } else {
        const firstVote = ourVotes[0] as { id: string } | undefined;
        if (firstVote?.id) {
          const { error: error8b } = await system.supabaseConnector.client
            .from('vote')
            .update({ comment: 'Updated by RLS test' })
            .eq('id', firstVote.id);

          if (error8b) {
            results.push(
              `❌ FAILED: Could not update own vote: ${error8b.message}`
            );
          } else {
            results.push('✅ SUCCESS: Can update own vote');
          }
        } else {
          results.push('⚠️ SKIPPED: No votes found to update');
        }
      }

      Alert.alert('RLS Policy Test Results', results.join('\n'), [
        { text: 'OK' }
      ]);
    } catch (error) {
      Alert.alert('Test Error', `Failed to complete tests: ${String(error)}`);
    }
  }, [userId]);

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
        <View style={{ marginBottom: spacing.medium }}>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: fontSizes.small,
              marginBottom: spacing.small
            }}
          >
            {statusText}
          </Text>
          <Pressable
            style={styles.testButton}
            onPress={testRLSPolicies}
            disabled={!userId}
          >
            <Text style={styles.testButtonText}>🔒 Test RLS Policies</Text>
          </Pressable>
        </View>
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
  },
  testButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    alignItems: 'center'
  },
  testButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: '600'
  }
});
