import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/contexts/SystemContext';
import { profile_project_link } from '@/db/drizzleSchema';
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
  const { db } = useSystem();

  // Query for membership status
  const { data: membershipLinks = [] } = useQuery({
    queryKey: ['membership-status', projectId, currentUser?.id],
    query: toCompilableQuery(
      db.query.profile_project_link.findMany({
        where: and(
          eq(profile_project_link.profile_id, currentUser?.id || ''),
          eq(profile_project_link.project_id, projectId),
          eq(profile_project_link.active, true)
        )
      })
    ),
    enabled: !!currentUser?.id && !!projectId && isPrivate
  });

  const isMember = membershipLinks.length > 0;
  const hasAccess = !isPrivate || isMember;
  const requiresAuth = isPrivate && !currentUser;
  const requiresMembership = isPrivate && currentUser && !isMember;

  return {
    hasAccess,
    isMember,
    requiresAuth,
    requiresMembership,
    isPrivate
  };
}
