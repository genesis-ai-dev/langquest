import { useColorScheme as useNativewindColorScheme } from 'nativewind';

export function useColorScheme() {
  const { colorScheme, ...rest } = useNativewindColorScheme();
  return {
    colorScheme: colorScheme ?? 'dark',
    isDarkColorScheme: colorScheme === 'dark',
    ...rest
  };
}
