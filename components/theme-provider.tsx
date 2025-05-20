import { useColorScheme } from '@/hooks/useColorScheme';
import { NAV_THEME } from '@/lib/constants';
import { themes } from '@/utils/color-theme';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider
} from '@react-navigation/native';
import { View } from 'react-native';

const THEMES = {
  dark: {
    ...DarkTheme,
    colors: NAV_THEME.dark
  },
  light: {
    ...DefaultTheme,
    colors: NAV_THEME.light
  }
} as const;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme } = useColorScheme();
  return (
    <NavigationThemeProvider value={THEMES[colorScheme]}>
      <View style={themes[colorScheme]} className="flex-1">
        {children}
      </View>
    </NavigationThemeProvider>
  );
}
