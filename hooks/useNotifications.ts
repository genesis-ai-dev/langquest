import { useAuth } from '@/contexts/AuthContext';
import { invite, profile_project_link, request } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, inArray } from 'drizzle-orm';
import React from 'react';

export const useNotifications = () => {
  const { currentUser } = useAuth();

  // Get all pending invites for the user's email
  const { data: inviteRequests } = useHybridData<typeof invite.$inferSelect>({
    dataType: 'invite-notifications-count',
    queryKeyParams: [currentUser?.email || ''],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db.query.invite.findMany({
        where: and(
          eq(invite.email, currentUser?.email || ''),
          eq(invite.status, 'pending'),
          eq(invite.active, true)
        )
      })
    ),

    // Cloud query
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('invite')
        .select('*')
        .eq('email', currentUser?.email || '')
        .eq('status', 'pending')
        .eq('active', true);
      if (error) throw error;
      return data as (typeof invite.$inferSelect)[];
    }
  });

  // Get all projects where the user is an owner
  const { data: ownerProjects } = useHybridData<{ project_id: string }>({
    dataType: 'owner-projects-count',
    queryKeyParams: [currentUser?.id || ''],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db.query.profile_project_link.findMany({
        where: and(
          eq(profile_project_link.profile_id, currentUser?.id || ''),
          eq(profile_project_link.membership, 'owner'),
          eq(profile_project_link.active, true)
        ),
        columns: { project_id: true }
      })
    ),

    // Cloud query
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('profile_project_link')
        .select('project_id')
        .eq('profile_id', currentUser?.id || '')
        .eq('membership', 'owner')
        .eq('active', true);
      if (error) throw error;
      return data as { project_id: string }[];
    }
  });

  const ownerProjectIds = React.useMemo(
    () => ownerProjects.map((p) => p.project_id),
    [ownerProjects]
  );

  // Get all pending requests for projects where user is owner
  const { data: allRequestNotifications } = useHybridData<
    typeof request.$inferSelect
  >({
    dataType: 'request-notifications-count',
    queryKeyParams: [...ownerProjectIds],

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
        : 'SELECT * FROM request WHERE 1=0', // Empty query when no owner projects

    // Cloud query
    cloudQueryFn: async () => {
      if (ownerProjectIds.length === 0) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('request')
        .select('*')
        .in('project_id', ownerProjectIds)
        .eq('status', 'pending')
        .eq('active', true);
      if (error) throw error;
      return data as (typeof request.$inferSelect)[];
    }
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
