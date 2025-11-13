import { cssTokens } from '@/generated-tokens';
import { getColorScheme, useColorScheme } from '@/hooks/useColorScheme';
import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import type { StyleProp, TextStyle } from 'react-native';
import { Platform, StyleSheet } from 'react-native';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type RemoveFirstTwoChars<T extends string> =
  T extends `${infer _}${infer _}${infer Rest}` ? Rest : '';

type ThemeName = keyof typeof cssTokens;
type TokenName = keyof (typeof cssTokens)[keyof typeof cssTokens];

export function toNavTheme(t: Record<string, string>) {
  return {
    background: t['--background']!,
    border: t['--border']!,
    card: t['--card']!,
    notification: t['--destructive']!,
    primary: t['--primary']!,
    text: t['--foreground']!
  };
}

export function getThemeToken(
  token: RemoveFirstTwoChars<TokenName>,
  theme?: ThemeName
) {
  const colorScheme = theme ?? getColorScheme();
  const scheme: ThemeName = colorScheme;
  return cssTokens[scheme][`--${token}`];
}

export function getThemeColor(
  color: RemoveFirstTwoChars<TokenName>,
  theme?: ThemeName
) {
  return `hsl(${getThemeToken(color, theme)})`;
}

export function useThemeToken(token: RemoveFirstTwoChars<TokenName>) {
  const { colorScheme } = useColorScheme();
  return getThemeToken(token, colorScheme);
}

export function useThemeColor(color: RemoveFirstTwoChars<TokenName>) {
  const { colorScheme } = useColorScheme();
  return getThemeColor(color, colorScheme);
}

// Map font weight to Noto Sans font variants
// Always returns a Noto Sans variant (never undefined on native)
export function getNotoSansFontFamily(
  className?: string,
  style?: StyleProp<TextStyle> | { fontWeight?: string | number }
): string | undefined {
  if (Platform.OS === 'web') {
    return undefined; // Web uses CSS (already configured in global.css)
  }

  // Extract fontWeight from style prop if it's a StyleProp
  let fontWeight: string | number | undefined;
  if (style) {
    const flattened = StyleSheet.flatten(style);
    if (typeof flattened === 'object' && 'fontWeight' in flattened) {
      fontWeight = flattened.fontWeight;
    } else if (typeof style === 'object' && 'fontWeight' in style) {
      fontWeight = (style as { fontWeight?: string | number }).fontWeight;
    }
  }

  // Check explicit fontWeight first (takes precedence)
  if (fontWeight) {
    if (fontWeight === '700' || fontWeight === 700 || fontWeight === 'bold')
      return 'NotoSans-Bold';
    if (fontWeight === '600' || fontWeight === 600) return 'NotoSans-SemiBold';
    if (fontWeight === '500' || fontWeight === 500) return 'NotoSans-Medium';
    return 'NotoSans-Regular';
  }

  // Check className for Tailwind font weight classes
  if (className) {
    if (
      className.includes('font-bold') ||
      className.includes('font-extrabold')
    ) {
      return 'NotoSans-Bold';
    }
    if (className.includes('font-semibold')) {
      return 'NotoSans-SemiBold';
    }
    if (className.includes('font-medium')) {
      return 'NotoSans-Medium';
    }
  }

  // Always default to Regular - Noto Sans is always applied
  return 'NotoSans-Regular';
}

// Apply Noto Sans font to a style
// Always applies Noto Sans, selecting the correct weight variant (Regular/Medium/SemiBold/Bold)
export function useNotoSans(
  className?: string,
  style?: StyleProp<TextStyle>
): StyleProp<TextStyle> {
  // Determine which Noto Sans variant to use based on className or style fontWeight
  const notoSansFont = getNotoSansFontFamily(className, style);

  // Merge Noto Sans font with existing style
  // StyleSheet.flatten handles all StyleProp types (arrays, objects, RegisteredStyle, etc.)
  const styles: (StyleProp<TextStyle> | null | undefined)[] = [
    notoSansFont ? { fontFamily: notoSansFont } : null,
    style
  ];

  const filtered = styles.filter((s): s is StyleProp<TextStyle> => Boolean(s));
  if (filtered.length === 0) {
    return undefined;
  }
  return StyleSheet.flatten(filtered) as StyleProp<TextStyle>;
}
