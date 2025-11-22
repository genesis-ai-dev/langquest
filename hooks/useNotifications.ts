import { useAuth } from '@/contexts/AuthContext';
import { invite, profile_project_link, request } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, inArray, or } from 'drizzle-orm';
import React from 'react';

export const useNotifications = () => {
  const { currentUser, isAuthenticated } = useAuth();

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

  // Get all projects where the user is an owner
  // Only query if user is authenticated and has an ID
  const userId = currentUser?.id;
  const shouldQueryOwnerProjects = !!userId && isAuthenticated;

  const { data: ownerProjects } = useHybridData<{ project_id: string }>({
    dataType: 'owner-projects-count',
    queryKeyParams: [userId || 'anonymous'],
    enabled: shouldQueryOwnerProjects, // Only query if user ID exists and user is authenticated

    // PowerSync query using Drizzle - only create if we have a valid user ID
    offlineQuery:
      shouldQueryOwnerProjects && userId
        ? toCompilableQuery(
            system.db.query.profile_project_link.findMany({
              where: and(
                eq(profile_project_link.profile_id, userId),
                eq(profile_project_link.membership, 'owner'),
                eq(profile_project_link.active, true)
              ),
              columns: { project_id: true }
            })
          )
        : ('SELECT * FROM profile_project_link WHERE 1=0' as any), // Placeholder query when disabled

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

  const inviteCount = inviteRequests.length;
  const requestCount = requestNotifications.length;

  return {
    inviteCount,
    requestCount,
    totalCount: inviteCount + requestCount
  };
};
