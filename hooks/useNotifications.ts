import { useAuth } from '@/contexts/AuthContext';
import {
  invite,
  profile_project_link,
  request
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';

export const useNotifications = () => {
  const { currentUser } = useAuth();

  // Get all pending invites for the user's email
  const { data: inviteRequests = [] } = useHybridQuery({
    queryKey: ['invite-notifications-count', currentUser?.email],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('invite')
        .select('*')
        .eq('email', currentUser?.email || '')
        .eq('status', 'pending')
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
    offlineQuery: toCompilableQuery(
      system.db.query.invite.findMany({
        where: and(
          eq(invite.email, currentUser?.email || ''),
          eq(invite.status, 'pending'),
          eq(invite.active, true)
        )
      })
    ),
    enabled: !!currentUser?.email
  });

  // Get all projects where the user is an owner
  const { data: ownerProjects = [] } = useHybridQuery({
    queryKey: ['owner-projects-count', currentUser?.id],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('profile_project_link')
        .select('project_id')
        .eq('profile_id', currentUser?.id || '')
        .eq('membership', 'owner')
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
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
    enabled: !!currentUser?.id
  });

  const ownerProjectIds = ownerProjects.map((p) => String(p.project_id || ''));

  // Get all pending requests for projects where user is owner
  const { data: requestNotifications = [] } = useHybridQuery({
    queryKey: ['request-notifications-count', ownerProjectIds],
    onlineFn: async () => {
      if (ownerProjectIds.length === 0) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('request')
        .select('*')
        .in('project_id', ownerProjectIds)
        .eq('status', 'pending')
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
    offlineQuery: toCompilableQuery(
      system.db.query.request.findMany({
        where: and(
          eq(request.status, 'pending'),
          eq(request.active, true)
        )
      })
    ),
    enabled: ownerProjectIds.length > 0
  });

  const inviteCount = inviteRequests.length;
  const requestCount = requestNotifications.filter(notification =>
    ownerProjectIds.includes(String(notification.project_id || ''))
  ).length;

  return {
    inviteCount,
    requestCount,
    totalCount: inviteCount + requestCount
  };
};
