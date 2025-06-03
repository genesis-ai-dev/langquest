import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@powersync/tanstack-react-query';

// Expiration constant - 7 days in milliseconds
const INVITATION_EXPIRY_DAYS = 7;
const INVITATION_EXPIRY_MS = INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export function useNotifications() {
  const { currentUser } = useAuth();

  // Helper function to check if invitation is expired
  const isExpired = (lastUpdated: string): boolean => {
    const updatedDate = new Date(lastUpdated);
    const now = new Date();
    return now.getTime() - updatedDate.getTime() > INVITATION_EXPIRY_MS;
  };

  // Get detailed notifications for filtering expired ones
  const { data: detailedNotifications = [] } = useQuery<{
    last_updated: string;
  }>({
    queryKey: ['detailed-notifications', currentUser?.email, currentUser?.id],
    query: `
      SELECT ir.last_updated
      FROM invite_request ir
      LEFT JOIN profile_project_link ppl ON ppl.project_id = ir.project_id AND ppl.profile_id = ?
      WHERE ir.active = 1
        AND ir.status = 'pending'
        AND (
          (ir.type = 'invite' AND ir.email = ?)
          OR 
          (ir.type = 'request' AND ppl.membership = 'owner' AND ppl.active = 1)
        )
    `,
    parameters: [currentUser?.id || '', currentUser?.email || ''],
    enabled: !!currentUser && !!currentUser.id && !!currentUser.email
  });

  // Filter out expired notifications and get final count
  const validNotificationsCount = detailedNotifications.filter(
    (item) => !isExpired(item.last_updated)
  ).length;

  return {
    notificationCount: validNotificationsCount
  };
}
