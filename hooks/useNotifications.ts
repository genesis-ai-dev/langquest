import { useAuth } from '@/contexts/AuthContext';
import { invite, profile_project_link, request } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { and, eq } from 'drizzle-orm';
import { useHybridSupabaseQuery } from './useHybridSupabaseQuery';

export const useNotifications = () => {
  const { currentUser } = useAuth();

  // Get all pending invites for the user's email
  const { data: inviteRequests = [] } = useHybridSupabaseQuery({
    queryKey: ['invite-notifications-count', currentUser?.email],
    query: system.db.query.invite.findMany({
      where: and(
        eq(invite.email, currentUser?.email || ''),
        eq(invite.status, 'pending'),
        eq(invite.active, true)
      )
    }),
    enabled: !!currentUser?.email
  });

  // Get all projects where the user is an owner
  const { data: ownerProjects = [] } = useHybridSupabaseQuery({
    queryKey: ['owner-projects-count', currentUser?.id],
    query: system.db.query.profile_project_link.findMany({
      where: and(
        eq(profile_project_link.profile_id, currentUser?.id || ''),
        eq(profile_project_link.membership, 'owner'),
        eq(profile_project_link.active, true)
      ),
      columns: { project_id: true }
    }),
    enabled: !!currentUser?.id
  });

  const ownerProjectIds = ownerProjects.map((p) => String(p.project_id || ''));

  // Get all pending requests for projects where user is owner
  const { data: requestNotifications = [] } = useHybridSupabaseQuery({
    queryKey: ['request-notifications-count', ownerProjectIds],
    query: system.db.query.request.findMany({
      where: and(eq(request.status, 'pending'), eq(request.active, true))
    }),
    enabled: ownerProjectIds.length > 0
  });

  const inviteCount = inviteRequests.length;
  const requestCount = requestNotifications.filter((notification) =>
    ownerProjectIds.includes(String(notification.project_id || ''))
  ).length;

  return {
    inviteCount,
    requestCount,
    totalCount: inviteCount + requestCount
  };
};
