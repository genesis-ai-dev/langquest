import { useLocalStore } from '@/store/localStore';
import {
  colorScheme as nativewindColorScheme,
  useColorScheme as useNativewindColorScheme
} from 'nativewind';

export function getColorScheme(): 'light' | 'dark' {
  const colorScheme = nativewindColorScheme.get();
  const stateTheme = useLocalStore.getState().theme;
  return stateTheme === 'system' ? colorScheme! : stateTheme;
}

export function useColorScheme() {
  // const colorScheme = useNativeColorScheme();
  const { colorScheme } = useNativewindColorScheme();

  const localTheme = useLocalStore((state) => state.theme);
  const setLocalTheme = useLocalStore((state) => state.setTheme);

  return {
    stateTheme: localTheme,
    colorScheme: colorScheme ?? 'dark',
    isDarkColorScheme: colorScheme === 'dark',
    setColorScheme: setLocalTheme
  };
}
