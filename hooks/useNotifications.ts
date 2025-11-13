import { useAuth } from '@/contexts/AuthContext';
import { invite, profile_project_link, request } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import React from 'react';

export const useNotifications = () => {
  const { currentUser } = useAuth();

  // Get all pending invites for the user's email or profile_id
  const { data: inviteRequests = [] } = useHybridData<
    typeof invite.$inferSelect
  >({
    dataType: 'invite-notifications-count',
    queryKeyParams: [currentUser?.id || '', currentUser?.email || ''],

    // PowerSync query using Drizzle - filter expired invites (7 days expiry)
    offlineQuery: toCompilableQuery(
      system.db.query.invite.findMany({
        where: and(
          ...[
            // Build invite matching condition - at least one must be true
            (currentUser?.id || currentUser?.email) &&
              or(
                currentUser.id
                  ? eq(invite.receiver_profile_id, currentUser.id)
                  : undefined,
                currentUser.email
                  ? eq(invite.email, currentUser.email)
                  : undefined
              ),
            eq(invite.status, 'pending'),
            eq(invite.active, true),
            // Filter out expired invites (7 days expiry) - SQLite datetime function
            sql`datetime(${invite.last_updated}) >= datetime('now', '-7 days')`
          ].filter(Boolean)
        )
      })
    ),
    enabled: !!(currentUser?.id || currentUser?.email)
  });

  // Get all projects where the user is an owner
  const { data: ownerProjects = [] } = useHybridData<{ project_id: string }>({
    dataType: 'owner-projects-count',
    queryKeyParams: [currentUser?.id || ''],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db.query.profile_project_link.findMany({
        where: and(
          eq(profile_project_link.profile_id, currentUser!.id),
          eq(profile_project_link.membership, 'owner'),
          eq(profile_project_link.active, true)
        ),
        columns: { project_id: true }
      })
    ),
    enabled: !!currentUser?.id
  });

  const ownerProjectIds = React.useMemo(
    () => ownerProjects.map((p) => p.project_id),
    [ownerProjects]
  );

  // Get all pending requests for projects where user is owner
  const { data: allRequestNotifications = [] } = useHybridData<
    typeof request.$inferSelect
  >({
    dataType: 'request-notifications-count',
    queryKeyParams: [...ownerProjectIds],

    // PowerSync query using Drizzle - filter expired requests (7 days expiry)
    offlineQuery: toCompilableQuery(
      system.db.query.request.findMany({
        where: and(
          eq(request.status, 'pending'),
          eq(request.active, true),
          inArray(request.project_id, ownerProjectIds)
        )
      })
    ),
    enabled: ownerProjectIds.length > 0
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
