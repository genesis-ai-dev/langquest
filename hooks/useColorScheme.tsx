import { useLocalStore } from '@/store/localStore';
import {
  colorScheme as nativewindColorScheme,
  useColorScheme as useNativewindColorScheme
} from 'nativewind';

export function getColorScheme(): 'light' | 'dark' {
  const stateTheme = useLocalStore.getState().theme;
  if (stateTheme !== 'system') {
    return stateTheme;
  }
  // Fallback to 'light' if nativewindColorScheme is not initialized
  if (!nativewindColorScheme) {
    return 'light';
  }
  const colorScheme = nativewindColorScheme.get();
  return colorScheme ?? 'light';
}

export function useColorScheme() {
  const { colorScheme } = useNativewindColorScheme();

  const localTheme = useLocalStore((state) => state.theme);
  const setLocalTheme = useLocalStore((state) => state.setTheme);

  const colorSchemeOrDefault = colorScheme ?? 'dark';

  return {
    stateTheme: localTheme,
    colorScheme: colorSchemeOrDefault,
    isDarkColorScheme: colorSchemeOrDefault === 'dark',
    setColorScheme: setLocalTheme
  };
}
