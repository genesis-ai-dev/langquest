import { applyTheme } from '@/features/appearance/iconTheme';
import { useLocalStore } from '@/store/localStore';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

/**
 * Swap the launcher icon only after the app leaves the foreground. Applying
 * while Android is showing .MainActivity disables that alias and kills the
 * process under the user.
 */
export function useDeferredIconTheme() {
  const appearanceThemeId = useLocalStore((s) => s.appearanceThemeId);
  const pendingThemeId = useRef(appearanceThemeId);

  useEffect(() => {
    pendingThemeId.current = appearanceThemeId;
  }, [appearanceThemeId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const applyPending = (state: AppStateStatus) => {
      if (state !== 'background' && state !== 'inactive') return;
      void applyTheme(pendingThemeId.current);
    };

    const sub = AppState.addEventListener('change', applyPending);
    return () => {
      sub.remove();
    };
  }, []);
}
