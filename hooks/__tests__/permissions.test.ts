/// <reference types="jest" />

import type { MembershipRole, Permission } from '../permissions';
import { can } from '../permissions';

const ROLES: MembershipRole[] = [undefined, 'member', 'owner'];

const CORE_PUBLIC: Permission[] = [
  'open_project',
  'download',
  'contribute',
  'vote',
  'translate',
  'edit_transcription'
];

const MEMBER_ONLY: Permission[] = [
  'view_membership',
  'project_card_membership_icon'
];

const OWNER_ONLY: Permission[] = [
  'manage',
  'project_settings_cog',
  'send_invite_section',
  'promote_member_button',
  'remove_member_button',
  'withdraw_invite_button'
];

const LOCKS: Permission[] = [
  'translate_button_lock',
  'transcribe_button_lock',
  'vote_button_lock'
];

describe('can()', () => {
  describe('public projects', () => {
    it.each(CORE_PUBLIC)(
      'allows %s for every role, including guests',
      (action) => {
        for (const role of ROLES) {
          expect(can(role, action, { private: false })).toBe(true);
        }
      }
    );

    it.each(MEMBER_ONLY)('allows %s only for members and owners', (action) => {
      expect(can(undefined, action, { private: false })).toBe(false);
      expect(can('member', action, { private: false })).toBe(true);
      expect(can('owner', action, { private: false })).toBe(true);
    });

    it.each(OWNER_ONLY)('allows %s only for owners', (action) => {
      expect(can(undefined, action, { private: false })).toBe(false);
      expect(can('member', action, { private: false })).toBe(false);
      expect(can('owner', action, { private: false })).toBe(true);
    });

    it.each(LOCKS)('hides %s', (action) => {
      for (const role of ROLES) {
        expect(can(role, action, { private: false })).toBe(false);
      }
    });
  });

  describe('private projects', () => {
    it.each(CORE_PUBLIC)(
      'denies %s to guests and allows members and owners',
      (action) => {
        expect(can(undefined, action, { private: true })).toBe(false);
        expect(can('member', action, { private: true })).toBe(true);
        expect(can('owner', action, { private: true })).toBe(true);
      }
    );

    it('treats admin like owner for manage', () => {
      expect(can('admin', 'manage', { private: true })).toBe(true);
      expect(can('admin', 'contribute', { private: true })).toBe(true);
    });

    it.each(LOCKS)('shows %s only to guests', (action) => {
      expect(can(undefined, action, { private: true })).toBe(true);
      expect(can('member', action, { private: true })).toBe(false);
      expect(can('owner', action, { private: true })).toBe(false);
    });
  });
});
