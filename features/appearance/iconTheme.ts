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

/**
 * Applies the icon theme with the given id. Passing null restores the default
 * app icon. On Android the app label also changes (handled by the native alias
 * declared at build time). On iOS the system shows an unavoidable confirmation
 * alert; that is accepted behaviour.
 */
export async function applyTheme(themeId: string | null): Promise<void> {
  if (Platform.OS === 'web') return;

  if (!themeId) {
    await setAppIdentity(DEFAULT_ALIAS, { showToast: false });
    return;
  }

  const profile = getThemeProfile(themeId);
  if (!profile) return;

  await setAppIdentity(profile.aliasName, { showToast: false });
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
