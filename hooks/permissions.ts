export type MembershipRole = 'member' | 'admin' | 'owner' | null | undefined;

export type Permission =
  | 'open_project'
  | 'download'
  | 'contribute'
  | 'view_membership'
  | 'vote'
  | 'translate'
  | 'edit_transcription'
  | 'manage'
  | 'project_card_membership_icon'
  | 'project_settings_cog'
  | 'send_invite_section'
  | 'promote_member_button'
  | 'remove_member_button'
  | 'withdraw_invite_button'
  | 'translate_button_lock'
  | 'transcribe_button_lock'
  | 'vote_button_lock';

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

const PERMISSION_LOOKUP = Object.entries(ROLE_PERMISSIONS).reduce(
  (acc, [role, permissions]) => {
    acc[role as NonNullable<MembershipRole>] = new Set(permissions);
    return acc;
  },
  {} as Record<NonNullable<MembershipRole>, Set<Permission>>
);

const LOCK_CONTROLS: Permission[] = [
  'translate_button_lock',
  'transcribe_button_lock',
  'vote_button_lock'
];

const PRIVACY_GATED_ACTIONS: Permission[] = [
  'open_project',
  'download',
  'contribute',
  'vote',
  'translate',
  'edit_transcription'
];

export function can(
  role: MembershipRole,
  action: Permission,
  options: { private: boolean }
): boolean {
  if (LOCK_CONTROLS.includes(action)) {
    return options.private && !role;
  }

  if (!options.private && PRIVACY_GATED_ACTIONS.includes(action)) {
    return true;
  }

  if (!role) return false;
  return PERMISSION_LOOKUP[role].has(action);
}
