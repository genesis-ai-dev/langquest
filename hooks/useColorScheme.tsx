import { useLocalStore } from '@/store/localStore';
import { useColorScheme as useNativewindColorScheme } from 'nativewind';

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
