import { Platform } from 'react-native';

import { getThemeProfile } from './profiles.data';

// This is the ONLY module that imports the native icon library, so the rest of
// the feature never references the third-party API surface directly. Everything
// else talks in terms of a theme id (e.g. "a01").
import { setAlternateAppIcon } from 'expo-alternate-app-icons';

/**
 * Applies the icon theme with the given id. Passing null restores the default
 * app icon.
 *
 * On Android this must not run while the current Activity is in the
 * foreground: disabling the launcher alias force-finishes the process.
 * Call this when the app is already backgrounding (see useDeferredIconTheme).
 *
 * On iOS 18 and earlier the system shows a confirmation alert. iOS 26 does not.
 */
export async function applyTheme(themeId: string | null): Promise<void> {
  if (Platform.OS === 'web') return;

  const alias = themeId ? (getThemeProfile(themeId)?.aliasName ?? null) : null;
  if (themeId && !alias) return;

  await setAlternateAppIcon(alias);
}
