import { useAuth } from '@/contexts/AuthContext';
import { profile_project_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
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
): {
  hasAccess: boolean;
  membership: typeof profile_project_link | null;
  isMembershipLoading: boolean;
} {
  const { currentUser } = useAuth();
  const { db } = system;

  // Query for membership status
  const { data: membershipLinks = [] } = useHybridQuery({
    queryKey: ['membership-status', project_id, currentUser?.id],
    onlineFn: async () => {
      const { data } = await system.supabaseConnector.client
        .from('profile_project_link')
        .select('*')
        .eq('profile_id', currentUser?.id || '')
        .eq('project_id', project_id)
        .eq('active', true);
      return data as typeof profile_project_link[];
    },
    offlineQuery: toCompilableQuery(
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

  console.log('RYDER', { membershipLinks, project_id, currentUser })

  // Get the first (and should be only) membership record
  const membershipData = membershipLinks?.[0];

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
    isMembershipLoading: isLoading,
    ...rest
  };
}
