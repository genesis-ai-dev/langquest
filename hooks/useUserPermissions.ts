import { useAuth } from '@/contexts/AuthContext';
import { project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useUserMemberships } from '@/hooks/db/useProfiles';
import { can } from '@/hooks/permissions';
import type { MembershipRole, Permission } from '@/hooks/permissions';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

export type { MembershipRole, Permission } from '@/hooks/permissions';

type Project = InferSelectModel<typeof project>;

export type PrivateAccessAction = Extract<
  Permission,
  | 'download'
  | 'contribute'
  | 'vote'
  | 'translate'
  | 'edit_transcription'
  | 'view_membership'
>;

export function useUserPermissions(
  project_id: string,
  action: Permission,
  knownIsPrivate?: boolean
): {
  hasAccess: boolean;
  membership: MembershipRole;
  isMembershipLoading: boolean;
  membershipData?: {
    project_id: string;
    membership: 'owner' | 'member';
    active: boolean;
  };
} {
  const { getUserMembership, isUserMembershipsLoading } = useUserMemberships();
  const { db } = system;
  const { currentUser } = useAuth();

  const isValidProjectId = Boolean(project_id && project_id.trim() !== '');
  const shouldQueryPrivacy = isValidProjectId && knownIsPrivate === undefined;

  const { data: projectData } = useHybridQuery<
    Pick<Project, 'private' | 'creator_id'>
  >({
    queryKey: ['project-privacy', project_id],
    offlineQuery: toCompilableQuery(
      db.query.project.findMany({
        where: eq(project.id, project_id),
        columns: { private: true, creator_id: true },
        limit: 1
      })
    ),
    cloudQueryFn: async () => {
      if (!shouldQueryPrivacy) return [];

      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('private, creator_id')
        .eq('id', project_id);

      if (error) throw error;
      return data as Pick<Project, 'private' | 'creator_id'>[];
    },
    enableCloudQuery: shouldQueryPrivacy
  });

  const linkMembershipData = getUserMembership(project_id);
  const isPrivate = knownIsPrivate ?? projectData[0]?.private ?? false;
  const isOwnerByCreator = Boolean(
    currentUser?.id && projectData[0]?.creator_id === currentUser.id
  );
  const effectiveMembership: MembershipRole =
    (linkMembershipData?.membership as MembershipRole) ||
    (isOwnerByCreator ? 'owner' : undefined);
  const effectiveMembershipData =
    linkMembershipData ||
    (isOwnerByCreator
      ? ({
          project_id,
          membership: 'owner',
          active: true
        } as const)
      : undefined);

  if (!isValidProjectId) {
    return {
      hasAccess: false,
      membership: undefined,
      isMembershipLoading: isUserMembershipsLoading,
      membershipData: undefined
    };
  }

  return {
    hasAccess: can(effectiveMembership, action, { private: isPrivate }),
    membership: effectiveMembership,
    isMembershipLoading: isUserMembershipsLoading,
    membershipData: effectiveMembershipData as {
      project_id: string;
      membership: 'owner' | 'member';
      active: boolean;
    }
  };
}
