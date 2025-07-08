import { useAuth } from '@/contexts/AuthProvider';
import { profile_project_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { and, eq } from 'drizzle-orm';
import { useHybridSupabaseQuery } from './useHybridSupabaseQuery';

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
  } = useHybridSupabaseQuery({
    queryKey: ['private-project-access', project_id, currentUser?.id, action],
    query: db.query.profile_project_link.findMany({
      where: and(
        eq(profile_project_link.project_id, project_id),
        eq(profile_project_link.profile_id, currentUser?.id || '')
      ),
      limit: 1
    }),
    enabled: !!project_id && !!currentUser?.id
  });

  const membership = membershipData?.[0];

  // Check if user has the required permissions
  const hasAccess = Boolean(
    membership?.active &&
      (membership.membership === 'owner' ||
        membership.membership === 'admin' ||
        (action === 'view-members' && membership.membership === 'member') ||
        (action === 'vote' && membership.membership === 'member') ||
        (action === 'translate' && membership.membership === 'member') ||
        (action === 'download' && membership.membership === 'member') ||
        (action === 'edit-transcription' &&
          (membership.membership === 'admin' ||
            membership.membership === 'owner')))
  );

  return {
    hasAccess,
    membership: membershipData,
    isMembershipLoading,
    ...rest
  };
}
