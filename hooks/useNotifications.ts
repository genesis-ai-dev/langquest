import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/contexts/SystemContext';
import { invite, profile_project_link, request } from '@/db/drizzleSchema';
import { isExpiredByLastUpdated } from '@/utils/dateUtils';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
import { and, eq } from 'drizzle-orm';

export function useNotifications() {
  const { currentUser } = useAuth();
  const { db } = useSystem();

  // Get all pending invites for the user's email
  const { data: inviteRequests = [] } = useQuery({
    queryKey: ['invite-notifications-count', currentUser?.email],
    query: toCompilableQuery(
      db.query.invite.findMany({
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
  const { data: ownerProjects = [] } = useQuery({
    queryKey: ['owner-projects-count', currentUser?.id],
    query: toCompilableQuery(
      db.query.profile_project_link.findMany({
        where: and(
          eq(profile_project_link.profile_id, currentUser?.id || ''),
          eq(profile_project_link.membership, 'owner'),
          eq(profile_project_link.active, true)
        )
      })
    ),
    enabled: !!currentUser?.id
  });

  const ownerProjectIds = ownerProjects.map((link) => link.project_id);

  // Get all pending requests for projects where user is owner
  const { data: requestNotifications = [] } = useQuery({
    queryKey: ['request-notifications-count', ownerProjectIds],
    query: toCompilableQuery(
      db.query.request.findMany({
        where: and(eq(request.status, 'pending'), eq(request.active, true))
      })
    ),
    enabled: ownerProjectIds.length > 0
  });

  // Filter request notifications to only include those for owned projects
  const validRequestNotifications = requestNotifications.filter((item) =>
    ownerProjectIds.includes(item.project_id)
  );

  // Combine all notifications and filter out expired ones
  const allNotifications = [...inviteRequests, ...validRequestNotifications];
  const validNotificationsCount = allNotifications.filter(
    (item) => !isExpiredByLastUpdated(item.last_updated)
  ).length;

  return {
    notificationCount: validNotificationsCount
  };
}
