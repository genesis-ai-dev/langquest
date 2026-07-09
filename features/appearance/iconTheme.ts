import { AppState, Platform } from 'react-native';

import { getThemeProfile } from './profiles.data';

// This is the ONLY module that imports the native icon library, so the rest of
// the feature never references the third-party API surface directly. Everything
// else talks in terms of a theme id (e.g. "a01").
import {
  getAppIconName,
  setAlternateAppIcon
} from 'expo-alternate-app-icons';

// On Android, switching disables the activity-alias the app is currently
// running from, and the OS kills the process on the spot (DONT_KILL_APP cannot
// protect the current task's root component). So the change is queued and
// applied when the app goes to background, where a task kill is harmless.
// iOS uses the safe alternate-icon API, so it switches right away.
// `undefined` = nothing queued; `null` = restore default icon.
let pendingAlias: string | null | undefined;
let listenerRegistered = false;

function queueForBackground(alias: string | null): void {
  pendingAlias = alias;
  if (listenerRegistered) return;
  listenerRegistered = true;
  AppState.addEventListener('change', (state) => {
    if (state !== 'background' || pendingAlias === undefined) return;
    const alias = pendingAlias;
    pendingAlias = undefined;
    setAlternateAppIcon(alias).catch(() => {
      // The process is likely being killed as part of the switch; nothing
      // useful can be done with the error.
    });
  });
}

/**
 * Applies the icon theme with the given id. Passing null restores the default
 * app icon. On Android the icon (and app label) updates shortly after the app
 * goes to background. On iOS the system shows an unavoidable confirmation
 * alert; that is accepted behaviour.
 */
export async function applyTheme(themeId: string | null): Promise<void> {
  if (Platform.OS === 'web') return;

  const alias = themeId ? (getThemeProfile(themeId)?.aliasName ?? null) : null;
  if (themeId && !alias) return;

  if (Platform.OS === 'android') {
    queueForBackground(alias);
    return;
  }

  await setAlternateAppIcon(alias);
}

/**
 * Returns the id of the currently applied theme, or null when the default icon
 * is active. Derives the id from the native alias name so it stays correct even
 * if the OS reset the alias. A queued-but-not-yet-applied Android change is
 * reported as current, since it will apply on next background.
 */
export function currentTheme(): string | null {
  if (Platform.OS === 'web') return null;

  const alias = pendingAlias !== undefined ? pendingAlias : getAppIconName();
  if (!alias) return null;

  // Alias names are "Theme" + slug-in-caps (e.g. ThemeA01 -> a01).
  const match = /^Theme([A-Z]\d{2})$/.exec(alias);
  return match?.[1] ? match[1].toLowerCase() : null;
}
