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

interface UsePrivateProjectAccessOptions {
  projectId: string;
  isPrivate: boolean;
}

export function usePrivateProjectAccess({
  projectId,
  isPrivate
}: UsePrivateProjectAccessOptions) {
  const { currentUser } = useAuth();
  const { db } = system;

  const {
    data: membershipData,
    isLoading: isMembershipLoading,
    ...rest
  } = useQuery({
    queryKey: ['private-project-access', projectId, currentUser?.id],
    query: toCompilableQuery(
      db.query.profile_project_link.findFirst({
        where: and(
          eq(profile_project_link.project_id, projectId),
          eq(profile_project_link.profile_id, currentUser?.id || ''),
          eq(profile_project_link.active, true)
        )
      })
    ),
    enabled: !!projectId && !!currentUser?.id && isPrivate
  });

  const isMember = !!membershipData?.[0];
  const hasAccess = !isPrivate || isMember;
  const requiresAuth = isPrivate && !currentUser;
  const requiresMembership = isPrivate && currentUser && !isMember;

  //log all the variables
  // console.log('isMember', isMember);
  // console.log('hasAccess', hasAccess);
  // console.log('requiresAuth', requiresAuth);
  // console.log('requiresMembership', requiresMembership);
  // console.log('isPrivate', isPrivate);
  // console.log('isMembershipLoading', isMembershipLoading);
  // console.log('rest', rest);

  return {
    hasAccess,
    isMember,
    requiresAuth,
    requiresMembership,
    isPrivate,
    isMembershipLoading,
    ...rest
  };
}
