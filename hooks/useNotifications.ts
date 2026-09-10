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
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import React from 'react';

export const useNotifications = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const userId = currentUser?.id;
  const shouldQueryOwnerProjects = !!userId && isAuthenticated;
  const enableProjectLanguageSuggestions = useLocalStore(
    (state) => state.enableProjectLanguageSuggestions
  );

  // Get all pending invites for the user's email or profile_id
  const { data: inviteRequests = [] } = useHybridQuery<
    typeof invite.$inferSelect
  >({
    queryKey: ['invite-notifications-count', currentUser?.id || '', currentUser?.email || 'anonymous'],
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
            eq(invite.active, true)
          ].filter(Boolean)
        )
      })
    ),
    enableOfflineQuery: !!(currentUser?.id || currentUser?.email),
    cloudQueryFn: async () => {
      if (!currentUser?.id && !currentUser?.email) return [];
      const match = [
        currentUser.id && `receiver_profile_id.eq.${currentUser.id}`,
        currentUser.email && `email.eq.${currentUser.email}`
      ]
        .filter(Boolean)
        .join(',');
      let query = system.supabaseConnector.client
        .from('invite')
        .select('*')
        .eq('status', 'pending')
        .eq('active', true);
      if (match) query = query.or(match);
      const { data, error } = await query.overrideTypes<
        (typeof invite.$inferSelect)[]
      >();
      if (error) throw error;
      return data;
    }
  });

  const { data: sentInviteDeliveryFailures = [] } = useHybridQuery<
    typeof invite.$inferSelect
  >({
    queryKey: ['invite-sent-delivery-failures-count', currentUser?.id || ''],
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
    enableOfflineQuery: !!currentUser?.id,
    cloudQueryFn: async () => {
      if (!currentUser?.id) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('invite')
        .select('*')
        .eq('sender_profile_id', currentUser.id)
        .in('status', ['pending', 'withdrawn'])
        .eq('active', true)
        .in('email_status', ['bounced', 'complained'])
        .is('bounce_notice_dismissed_at', null)
        .overrideTypes<(typeof invite.$inferSelect)[]>();
      if (error) throw error;
      return data;
    }
  });

  // Get all projects where the user is an owner

  const { data: ownerProjects } = useHybridQuery<{ project_id: string }>({
    queryKey: ['owner-projects-count', userId],
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
  const { data: allRequestNotifications } = useHybridQuery<
    typeof request.$inferSelect
  >({
    queryKey: ['request-notifications-count', requestQueryKey],
    enabled: ownerProjectIds.length > 0 && shouldQueryOwnerProjects, // Only query if we have owner projects

    // PowerSync query using Drizzle
    offlineQuery:
      ownerProjectIds.length > 0
        ? toCompilableQuery(
            system.db.query.request.findMany({
              where: and(
                eq(request.active, true),
                inArray(request.project_id, ownerProjectIds)
              )
            })
          )
        : 'SELECT * FROM request WHERE 1=0',
    cloudQueryFn: async () => {
      if (ownerProjectIds.length === 0) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('request')
        .select('*')
        .in('project_id', ownerProjectIds)
        .eq('status', 'pending')
        .eq('active', true)
        .overrideTypes<(typeof request.$inferSelect)[]>();
      if (error) throw error;
      return data;
    }
  });

  // Filter to only include requests for projects where user is owner
  // Resolved rows stay in SQLite so they win over a stale pending cloud snapshot.
  const requestNotifications = React.useMemo(
    () =>
      allRequestNotifications.filter(
        (notification) =>
          notification.status === 'pending' &&
          ownerProjectIds.includes(notification.project_id)
      ),
    [allRequestNotifications, ownerProjectIds]
  );

  const { data: languoidSuggestions = [] } = useHybridQuery<{
    languoid_id: string;
  }>({
    queryKey: ['languoid-suggestions-count', userId || 'anonymous'],
    enabled: enableProjectLanguageSuggestions && !!userId && isAuthenticated,

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
  const { data: projectLanguoidSuggestions = [] } = useHybridQuery<{
    id: string;
  }>({
    queryKey: ['project-languoid-suggestions-count', requestQueryKey],
    enabled:
      enableProjectLanguageSuggestions &&
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

  const inviteCount = inviteRequests.filter(
    (item) => item.status === 'pending'
  ).length;
  const requestCount = requestNotifications.length;
  // Ignore cached query data when the feature flag is off (matches NotificationsView)
  const languoidLinkCount = enableProjectLanguageSuggestions
    ? languoidSuggestions.length
    : 0;
  const projectLanguoidSuggestionCount = enableProjectLanguageSuggestions
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
