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
    data: membershipData,
    isLoading: isMembershipLoading,
    ...rest
  } = useQuery({
    queryKey: ['private-project-access', project_id, currentUser?.id, action],
    query: toCompilableQuery(
      db.query.profile_project_link.findFirst({
        where: and(
          eq(profile_project_link.project_id, project_id),
          eq(profile_project_link.profile_id, currentUser?.id || '')
        )
      })
    ),
    enabled: !!project_id && !!currentUser?.id
  });

  // Check if user has the required permissions
  const hasAccess = Boolean(
    membershipData?.active &&
    (membershipData.membership === 'owner' ||
      membershipData.membership === 'admin' ||
      (action === 'view-members' && membershipData.membership === 'member') ||
      (action === 'vote' && membershipData.membership === 'member') ||
      (action === 'translate' && membershipData.membership === 'member') ||
      (action === 'download' && membershipData.membership === 'member') ||
      (action === 'edit-transcription' &&
        (membershipData.membership === 'admin' || membershipData.membership === 'owner')))
  );

  return {
    hasAccess,
    membership: membershipData,
    isMembershipLoading,
    ...rest
  };
}
