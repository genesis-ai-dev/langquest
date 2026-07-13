import { Platform } from 'react-native';

import { getThemeProfile } from './profiles.data';

// This is the ONLY module that imports the native icon library, so the rest of
// the feature never references the third-party API surface directly. Everything
// else talks in terms of a theme id (e.g. "a01").
import { getAppIconName, setAlternateAppIcon } from 'expo-alternate-app-icons';

/**
 * Applies the icon theme with the given id. Passing null restores the default
 * app icon.
 *
 * On Android this must run while the app is still foregrounded:
 * `expo-alternate-app-icons` needs a live Activity/ReactContext, so a
 * background-deferred call is a silent no-op in release builds. Disabling the
 * current launcher component can kill the process; that is accepted — the icon
 * change itself is what matters.
 *
 * On iOS the system shows an unavoidable confirmation alert; that is accepted
 * behaviour.
 */
export async function applyTheme(themeId: string | null): Promise<void> {
  if (Platform.OS === 'web') return;

  const alias = themeId ? (getThemeProfile(themeId)?.aliasName ?? null) : null;
  if (themeId && !alias) return;

  await setAlternateAppIcon(alias);
}

/**
 * Returns the id of the currently applied theme, or null when the default icon
 * is active. Derives the id from the native alias name so it stays correct even
 * if the OS reset the alias.
 */
export function currentTheme(): string | null {
  if (Platform.OS === 'web') return null;

  const alias = getAppIconName();
  if (!alias) return null;

  // Alias names are "Theme" + slug-in-caps (e.g. ThemeA01 -> a01).
  const match = /^Theme([A-Z]\d{2})$/.exec(alias);
  return match?.[1] ? match[1].toLowerCase() : null;
}
