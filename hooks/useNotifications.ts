import { useAuth } from '@/contexts/AuthContext';
import {
  invite,
  languoid_link_suggestion,
  profile_project_link,
  project_languoid_suggestion,
  request
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalStore } from '@/store/localStore';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import React from 'react';

export const useNotifications = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const userId = currentUser?.id;
  const shouldQueryOwnerProjects = !!userId && isAuthenticated;
  const enableLanguoidLinkSuggestions = useLocalStore(
    (state) => state.enableLanguoidLinkSuggestions
  );
  const enableProjectLanguoidSuggestions = useLocalStore(
    (state) => state.enableProjectLanguoidSuggestions
  );

  // Get all pending invites for the user's email or profile_id
  const { data: inviteRequests = [] } = useHybridData<
    typeof invite.$inferSelect
  >({
    dataType: 'invite-notifications-count',
    queryKeyParams: [currentUser?.id || '', currentUser?.email || 'anonymous'],
    enabled: !!(currentUser?.id || currentUser?.email) && isAuthenticated, // Only query if user has id or email and is authenticated

    // PowerSync query using Drizzle - filter expired invites (7 days expiry)
    offlineQuery: toCompilableQuery(
      system.db.query.invite.findMany({
        where: and(
          ...[
            // Build invite matching condition - at least one must be true
            (currentUser?.id || currentUser?.email) &&
              or(
                ...[
                  currentUser.id &&
                    eq(invite.receiver_profile_id, currentUser.id),
                  currentUser.email && eq(invite.email, currentUser.email)
                ].filter(Boolean)
              ),
            eq(invite.status, 'pending'),
            eq(invite.active, true)
          ].filter(Boolean)
        )
      })
    ),
    enableOfflineQuery: !!(currentUser?.id || currentUser?.email)
  });

  const { data: sentInviteDeliveryFailures = [] } = useHybridData<
    typeof invite.$inferSelect
  >({
    dataType: 'invite-sent-delivery-failures-count',
    queryKeyParams: [currentUser?.id || ''],
    enabled: !!currentUser?.id && isAuthenticated,

    offlineQuery: toCompilableQuery(
      system.db.query.invite.findMany({
        where: and(
          ...[
            currentUser?.id && eq(invite.sender_profile_id, currentUser.id),
            or(eq(invite.status, 'pending'), eq(invite.status, 'withdrawn')),
            eq(invite.active, true),
            inArray(invite.email_status, ['bounced', 'complained']),
            isNull(invite.bounce_notice_dismissed_at)
          ].filter(Boolean)
        )
      })
    ),
    enableOfflineQuery: !!currentUser?.id
  });

  // Get all projects where the user is an owner

  const { data: ownerProjects } = useHybridData<{ project_id: string }>({
    dataType: 'owner-projects-count',
    queryKeyParams: [userId],
    enabled: shouldQueryOwnerProjects && !!userId, // Only query if user ID exists and user is authenticated
    getItemId: (item) => item.project_id,

    // PowerSync query using Drizzle - only create if we have a valid user ID
    offlineQuery: toCompilableQuery(
      system.db.query.profile_project_link.findMany({
        where: and(
          eq(profile_project_link.profile_id, userId!),
          eq(profile_project_link.membership, 'owner'),
          eq(profile_project_link.active, true)
        ),
        columns: { project_id: true }
      })
    ),

    // Cloud query
    cloudQueryFn: async () => {
      // Guard: return empty array if no user ID (anonymous users or not yet loaded)
      if (!userId) return [];

      const { data, error } = await system.supabaseConnector.client
        .from('profile_project_link')
        .select('project_id')
        .eq('profile_id', userId)
        .eq('membership', 'owner')
        .eq('active', true);
      if (error) throw error;
      return data as { project_id: string }[];
    }
  });

  // Stabilize ownerProjectIds to prevent query key changes on every render
  const ownerProjectIds = React.useMemo(() => {
    const ids = ownerProjects.map((p) => p.project_id);
    // Sort to ensure consistent order for query key stability (don't mutate original)
    return [...ids].sort();
  }, [ownerProjects]);

  // Stabilize query key params - use a string representation for consistency
  const requestQueryKey = React.useMemo(
    () => ownerProjectIds.join(','),
    [ownerProjectIds]
  );

  // Get all pending requests for projects where user is owner
  const { data: allRequestNotifications } = useHybridData<
    typeof request.$inferSelect
  >({
    dataType: 'request-notifications-count',
    queryKeyParams: [requestQueryKey],
    enabled: ownerProjectIds.length > 0 && shouldQueryOwnerProjects, // Only query if we have owner projects

    // PowerSync query using Drizzle
    offlineQuery:
      ownerProjectIds.length > 0
        ? toCompilableQuery(
            system.db.query.request.findMany({
              where: and(
                eq(request.status, 'pending'),
                eq(request.active, true),
                inArray(request.project_id, ownerProjectIds)
              )
            })
          )
        : 'SELECT * FROM request WHERE 1=0' // Empty query when no owner projects

    // Cloud query
    // cloudQueryFn: async () => {
    //   if (ownerProjectIds.length === 0) return [];
    //   const { data, error } = await system.supabaseConnector.client
    //     .from('request')
    //     .select('*')
    //     .in('project_id', ownerProjectIds)
    //     .eq('status', 'pending')
    //     .eq('active', true);
    //   if (error) throw error;
    //   return data as (typeof request.$inferSelect)[];
    // }
  });

  // Filter to only include requests for projects where user is owner
  const requestNotifications = React.useMemo(
    () =>
      allRequestNotifications.filter((notification) =>
        ownerProjectIds.includes(notification.project_id)
      ),
    [allRequestNotifications, ownerProjectIds]
  );

  const { data: languoidSuggestions = [] } = useHybridData<{
    languoid_id: string;
  }>({
    dataType: 'languoid-suggestions-count',
    queryKeyParams: [userId || 'anonymous'],
    enabled: enableLanguoidLinkSuggestions && !!userId && isAuthenticated,

    // Get pending languoid link suggestions count
    // Query returns distinct languoid_id to count unique languoids needing linking
    offlineQuery: toCompilableQuery(
      system.db
        .selectDistinct({
          languoid_id: languoid_link_suggestion.languoid_id
        })
        .from(languoid_link_suggestion)
        .where(
          and(
            eq(languoid_link_suggestion.profile_id, userId!),
            eq(languoid_link_suggestion.status, 'pending'),
            eq(languoid_link_suggestion.active, true)
          )
        )
    ),

    cloudQueryFn: async () => {
      if (!userId) return [];

      const { data, error } = await system.supabaseConnector.client
        .from('languoid_link_suggestion')
        .select('languoid_id')
        .eq('profile_id', userId)
        .eq('status', 'pending')
        .eq('active', true);

      if (error) throw error;

      // Get unique languoid_ids
      const uniqueIds = [...new Set(data.map((d) => d.languoid_id as string))];
      return uniqueIds.map((id) => ({ languoid_id: id }));
    }
  });

  // Project language suggestions (Event 1): pending suggestions for projects
  // this user owns. RLS guarantees only owners see rows, but we additionally
  // gate on the local owner-projects list so the count never includes stale
  // synced data after a membership change.
  const { data: projectLanguoidSuggestions = [] } = useHybridData<{
    id: string;
  }>({
    dataType: 'project-languoid-suggestions-count',
    queryKeyParams: [requestQueryKey],
    enabled:
      enableProjectLanguoidSuggestions &&
      ownerProjectIds.length > 0 &&
      shouldQueryOwnerProjects,
    offlineQuery:
      ownerProjectIds.length > 0
        ? toCompilableQuery(
            system.db
              .select({ id: project_languoid_suggestion.id })
              .from(project_languoid_suggestion)
              .where(
                and(
                  inArray(
                    project_languoid_suggestion.project_id,
                    ownerProjectIds
                  ),
                  eq(project_languoid_suggestion.status, 'pending'),
                  eq(project_languoid_suggestion.active, true)
                )
              )
          )
        : 'SELECT id FROM project_languoid_suggestion WHERE 1=0',
    cloudQueryFn: async () => {
      if (ownerProjectIds.length === 0) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project_languoid_suggestion')
        .select('id')
        .in('project_id', ownerProjectIds)
        .eq('status', 'pending')
        .eq('active', true);
      if (error) throw error;
      return data as { id: string }[];
    }
  });

  const inviteCount = inviteRequests.length;
  const requestCount = requestNotifications.length;
  // Ignore cached query data when the feature flag is off (matches NotificationsView)
  const languoidLinkCount = enableLanguoidLinkSuggestions
    ? languoidSuggestions.length
    : 0;
  const projectLanguoidSuggestionCount = enableProjectLanguoidSuggestions
    ? projectLanguoidSuggestions.length
    : 0;
  const sentInviteDeliveryFailureCount = sentInviteDeliveryFailures.length;

  return {
    inviteCount,
    requestCount,
    languoidLinkCount,
    projectLanguoidSuggestionCount,
    sentInviteDeliveryFailureCount,
    totalCount:
      inviteCount +
      requestCount +
      languoidLinkCount +
      projectLanguoidSuggestionCount +
      sentInviteDeliveryFailureCount
  };
};
