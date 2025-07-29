import { project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useUserMemberships } from '@/hooks/db/useProfiles';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

// Type definition
type Project = InferSelectModel<typeof project>;

/**
 * # Access Control Constraints
| Action/Element    | Non-member       | Member | Owner | Notes                                                              | Action |
| ----------------- | ---------------- | ------ | ----- | ------------------------------------------------------------------ | ------ |
| **Core Actions**  |                  |        |       |                                                                    | |
| Open Project      | Gate (bypass)    | ✓      | ✓     | Only gated if private                                              | open_project |
| Download          | Gate (bypass)    | ✓      | ✓     | Only gated if private                                              | download |
| Contribute        | Gate (no bypass) | ✓      | ✓     | Includes voting, translation, transcription; only gated if private | contribute |
| View Membership   | Gate (no bypass) | ✓      | ✓     | Always gated regardless of privacy                                 | view_membership |
| Manage            | ✕                | ✕      | ✓     |                                                                    | manage |
| **UI Elements**   |                  |        |       |                                                                    |        |
| Membership Icon   | -                | 👤     | 🏅    |                                                                    | project_card_membership_icon |
| Settings Cog      | ✕                | ✕      | ✓     |                                                                    | project_settings_cog |
| Send Invite       | ✕                | ✕      | ✓     |                                                                    | send_invite_section |
| Promote Member    | ✕                | ✕      | ✓     |                                                                    | promote_member_button |
| Remove Member     | ✕                | ✕      | ✓     |                                                                    | remove_member_button |
| Withdraw Invite   | ✕                | ✕      | ✓     |                                                                    | withdraw_invite_button |
| **Lock Controls** |                  |        |       |                                                                    |        |
| Translate Lock    | ⚡                | ✕      | ✕     | Visible only if private                                            | translate_button_lock |
| Transcribe Lock   | ⚡                | ✕      | ✕     | Visible only if private                                            | transcribe_button_lock |
| Vote Lock         | ⚡                | ✕      | ✕     | Visible only if private                                            | vote_button_lock |

Legend:
- ✓ = Allowed/Visible
- ✕ = Hidden/Not Allowed
- ⚡ = Conditionally Visible
- Gate = Access Gate Shown
**/

export type MembershipRole = 'member' | 'admin' | 'owner' | null | undefined;

export type Permission =
  // Core Actions
  | 'open_project'
  | 'download'
  | 'contribute'
  | 'view_membership'
  // Specific Contribution Actions (all use same permission as 'contribute')
  | 'vote'
  | 'translate'
  | 'edit_transcription'
  // Admin Actions
  | 'manage'
  // UI Elements
  | 'project_card_membership_icon'
  | 'project_settings_cog'
  | 'send_invite_section'
  | 'promote_member_button'
  | 'remove_member_button'
  | 'withdraw_invite_button'
  // Lock Controls
  | 'translate_button_lock'
  | 'transcribe_button_lock'
  | 'vote_button_lock';

// Actions that PrivateAccessGate handles (subset of Permission)
export type PrivateAccessAction = Extract<
  Permission,
  | 'download'
  | 'contribute'
  | 'vote'
  | 'translate'
  | 'edit_transcription'
  | 'view_membership'
>;

// Base permissions that all roles share
const MEMBER_PERMISSIONS: Permission[] = [
  'open_project',
  'download',
  'contribute',
  'vote',
  'translate',
  'edit_transcription',
  'view_membership',
  'project_card_membership_icon'
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...MEMBER_PERMISSIONS,
  'manage',
  'project_settings_cog',
  'send_invite_section',
  'promote_member_button',
  'remove_member_button',
  'withdraw_invite_button'
];

const OWNER_PERMISSIONS: Permission[] = [...ADMIN_PERMISSIONS];

const ROLE_PERMISSIONS: Record<NonNullable<MembershipRole>, Permission[]> = {
  member: MEMBER_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  owner: OWNER_PERMISSIONS
};

// Efficient lookup: Create Sets for O(1) permission checking
const PERMISSION_LOOKUP = Object.entries(ROLE_PERMISSIONS).reduce(
  (acc, [role, permissions]) => {
    acc[role as NonNullable<MembershipRole>] = new Set(permissions);
    return acc;
  },
  {} as Record<NonNullable<MembershipRole>, Set<Permission>>
);

export function useUserPermissions(
  project_id: string,
  action: Permission,
  knownIsPrivate?: boolean // Optional: avoid duplicate query if caller already knows
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

  // Don't run queries if project_id is empty or invalid
  const isValidProjectId = Boolean(project_id && project_id.trim() !== '');

  // Only query for privacy if not provided
  const shouldQueryPrivacy = isValidProjectId && knownIsPrivate === undefined;

  // Query for project details to get privacy setting using useHybridData
  const { data: projectData } = useHybridData<Pick<Project, 'private'>>({
    dataType: 'project-privacy',
    queryKeyParams: [project_id],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      db.query.project.findMany({
        where: eq(project.id, project_id),
        columns: { private: true },
        limit: 1
      })
    ),

    // Cloud query
    cloudQueryFn: async () => {
      if (!shouldQueryPrivacy) return [];

      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('private')
        .eq('id', project_id);

      if (error) throw error;
      return data as Pick<Project, 'private'>[];
    },

    // Only enable cloud query when we should query privacy
    enableCloudQuery: shouldQueryPrivacy
  });

  // Get membership from user memberships hook
  const membershipData = getUserMembership(project_id);
  const isPrivate = knownIsPrivate ?? projectData[0]?.private ?? false;
  const membership = membershipData?.membership as MembershipRole;

  // If project_id is invalid, return no access
  if (!isValidProjectId) {
    return {
      hasAccess: false,
      membership: undefined,
      isMembershipLoading: isUserMembershipsLoading,
      membershipData: undefined
    };
  }

  // Special handling for lock controls
  const lockControls: Permission[] = [
    'translate_button_lock',
    'transcribe_button_lock',
    'vote_button_lock'
  ];

  if (lockControls.includes(action)) {
    // Lock controls are only visible if:
    // 1. Project is private AND
    // 2. User is not a member (or not logged in)
    const isLockVisible = isPrivate && !membership;

    return {
      hasAccess: isLockVisible,
      membership,
      isMembershipLoading: isUserMembershipsLoading,
      membershipData: membershipData as {
        project_id: string;
        membership: 'owner' | 'member';
        active: boolean;
      }
    };
  }

  // For privacy-gated actions (open_project, download, contribute), check if project is private
  const privacyGatedActions: Permission[] = [
    'open_project',
    'download',
    'contribute',
    'vote',
    'translate',
    'edit_transcription'
  ];

  // Public projects allow all core actions except view_membership
  if (!isPrivate && privacyGatedActions.includes(action)) {
    return {
      hasAccess: true,
      membership,
      isMembershipLoading: isUserMembershipsLoading
    };
  }

  // For private projects or always-gated actions, check membership permissions
  const hasRolePermission = Boolean(
    membership && PERMISSION_LOOKUP[membership].has(action)
  );

  return {
    hasAccess: hasRolePermission,
    membership,
    isMembershipLoading: isUserMembershipsLoading,
    membershipData: membershipData as {
      project_id: string;
      membership: 'owner' | 'member';
      active: boolean;
    }
  };
}
