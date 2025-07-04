import { useAuth } from '@/contexts/AuthContext';
import { profile_project_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
import { and, eq } from 'drizzle-orm';

export type PrivateAccessAction =
  | 'view-members'
  | 'vote'
  | 'translate'
  | 'edit-transcription'
  | 'download';

export function usePrivateProjectAccess(
  project_id: string,
  action: PrivateAccessAction
) {
  const { currentUser } = useAuth();
  const { db } = system;

  const {
    data: membershipDataArray,
    isLoading: isMembershipLoading,
    ...rest
  } = useQuery({
    queryKey: ['private-project-access', project_id, currentUser?.id, action],
    query: toCompilableQuery(
      db.query.profile_project_link.findMany({
        where: and(
          eq(profile_project_link.project_id, project_id),
          eq(profile_project_link.profile_id, currentUser?.id || '')
        ),
        limit: 1
      })
    ),
    enabled: !!project_id && !!currentUser?.id
  });

  // Get the first (and should be only) membership record
  const membershipData = membershipDataArray?.[0];

  // Define permission levels and their allowed actions
  const memberActions = ['view-members', 'vote', 'translate', 'download'];
  const adminActions = [...memberActions, 'edit-transcription'];
  const ownerActions = [...adminActions];

  const permissionLevels = {
    member: memberActions,
    admin: adminActions,
    owner: ownerActions
  };

  // Check if user has the required permissions based on role
  const hasAccess = Boolean(
    membershipData?.active &&
    membershipData.membership &&
    permissionLevels[
      membershipData.membership as keyof typeof permissionLevels
    ].includes(action)
  );

  return {
    hasAccess,
    membership: membershipData,
    isMembershipLoading,
    ...rest
  };
}
