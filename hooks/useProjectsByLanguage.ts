import {
  project,
  project_language_link,
  profile_project_link
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, getTableColumns, inArray, notInArray, or, sql } from 'drizzle-orm';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRestrictions } from '@/hooks/db/useBlocks';
import { useLocalStore } from '@/store/localStore';

type Project = typeof project.$inferSelect;

/**
 * Hook to query projects filtered by target languoid ID
 * Excludes projects the user is already a member of
 * Respects user's privacy settings and blocked content/users
 */
export function useProjectsByLanguage(languoidId: string | null) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;

  const showInvisibleContent = useLocalStore(
    (state) => state.showHiddenContent
  );

  const { data: restrictions } = useUserRestrictions(
    'project',
    true,
    true,
    false
  );

  const blockContentIds = (restrictions.blockedContentIds ?? []).map(
    (c) => c.content_id
  );
  const blockUserIds = (restrictions.blockedUserIds ?? []).map(
    (c) => c.blocked_id
  );

  return useHybridData<Project>({
    dataType: 'projects-by-languoid',
    queryKeyParams: [
      languoidId || '',
      userId || '',
      showInvisibleContent ? 'show-hidden' : ''
    ],

    // Offline query - get projects by target languoid via project_language_link
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          ...getTableColumns(project)
        })
        .from(project)
        .innerJoin(
          project_language_link,
          and(
            eq(project_language_link.project_id, project.id),
            eq(project_language_link.language_type, 'target')
          )
        )
        .where(
          and(
            ...[
              languoidId
                ? eq(project_language_link.languoid_id, languoidId)
                : undefined,
              eq(project.active, true),
              // Exclude projects user is already a member of
              userId &&
                sql`NOT EXISTS (
                  SELECT 1 FROM ${profile_project_link}
                  WHERE ${profile_project_link.project_id} = ${project.id}
                  AND ${profile_project_link.profile_id} = ${userId}
                  AND ${profile_project_link.active} = 1
                )`,
              // Visibility filter
              or(
                !showInvisibleContent ? eq(project.visible, true) : undefined,
                userId ? eq(project.creator_id, userId) : undefined
              ),
              // Blocked users filter
              blockUserIds.length > 0 &&
                notInArray(project.creator_id, blockUserIds),
              // Blocked content filter
              blockContentIds.length > 0 &&
                notInArray(project.id, blockContentIds)
            ].filter(Boolean)
          )
        )
    ),

    // Cloud query - get projects by target languoid via project_language_link
    cloudQueryFn: async () => {
      if (!languoidId) return [];

      // Get projects user is already a member of (to exclude)
      const userProjectIds = userId
        ? await system.supabaseConnector.client
            .from('profile_project_link')
            .select('project_id')
            .eq('profile_id', userId)
            .eq('active', true)
            .then(({ data }) => data?.map((p) => p.project_id) || [])
        : [];

      // First, get project IDs that match the target languoid
      const { data: projectLinks, error: linkError } =
        await system.supabaseConnector.client
          .from('project_language_link')
          .select('project_id')
          .eq('languoid_id', languoidId)
          .eq('language_type', 'target');

      if (linkError) throw linkError;
      if (!projectLinks || projectLinks.length === 0) return [];

      const matchingProjectIds = projectLinks.map((link) => link.project_id);

      let query = system.supabaseConnector.client
        .from('project')
        .select('*')
        .in('id', matchingProjectIds)
        .eq('active', true);

      // Exclude projects user is already a member of
      if (userProjectIds.length > 0) {
        query = query.not('id', 'in', `(${userProjectIds.join(',')})`);
      }

      // Visibility filter
      if (!showInvisibleContent) {
        query = query.eq('visible', true);
      }

      // Blocked users filter
      if (blockUserIds.length > 0) {
        query = query.or(
          `creator_id.is.null,creator_id.not.in.(${blockUserIds.join(',')})`
        );
      }

      // Blocked content filter
      if (blockContentIds.length > 0) {
        query = query.not('id', 'in', `(${blockContentIds.join(',')})`);
      }

      const { data, error } = await query.overrideTypes<Project[]>();

      if (error) throw error;
      return data || [];
    },

    enableCloudQuery: !!languoidId,
    enableOfflineQuery: !!languoidId
  });
}
