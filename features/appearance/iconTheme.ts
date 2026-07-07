import { Platform } from 'react-native';

import { getThemeProfile } from './profiles.data';

// This is the ONLY module that imports the native icon library, so the rest of
// the feature never references the third-party API surface directly. Everything
// else talks in terms of a theme id (e.g. "a01").
import {
  getAppIdentity,
  setAppIdentity
} from '@praneeth26/expo-dynamic-app-identity';

const DEFAULT_ALIAS = 'DEFAULT';

// On Android, switching immediately would disable the activity-alias the app
// is currently running from, and the OS kills the process on the spot
// (DONT_KILL_APP cannot protect the current task's root component). Deferred
// mode records the change and the plugin's lifecycle listener applies it a few
// seconds after the app is backgrounded, when a task kill is harmless. iOS
// uses the safe alternate-icon API, so it can switch right away.
const SWITCH_OPTIONS = {
  showToast: false,
  immediate: Platform.OS !== 'android',
  delay: 3000
} as const;

/**
 * Applies the icon theme with the given id. Passing null restores the default
 * app icon. On Android the icon (and app label) updates shortly after the app
 * goes to background. On iOS the system shows an unavoidable confirmation
 * alert; that is accepted behaviour.
 */
export async function applyTheme(themeId: string | null): Promise<void> {
  if (Platform.OS === 'web') return;

  if (!themeId) {
    await setAppIdentity(DEFAULT_ALIAS, SWITCH_OPTIONS);
    return;
  }

  const profile = getThemeProfile(themeId);
  if (!profile) return;

  await setAppIdentity(profile.aliasName, SWITCH_OPTIONS);
}

/**
 * Returns the id of the currently applied theme, or null when the default icon
 * is active. Derives the id from the native alias name so it stays correct even
 * if the OS reset the alias.
 */
export function currentTheme(): string | null {
  if (Platform.OS === 'web') return null;

  const alias = getAppIdentity();
  if (!alias || alias === DEFAULT_ALIAS) return null;

  // Alias names are "Theme" + slug-in-caps (e.g. ThemeA01 -> a01).
  const match = /^Theme([A-Z]\d{2})$/.exec(alias);
  return match?.[1] ? match[1].toLowerCase() : null;
}
