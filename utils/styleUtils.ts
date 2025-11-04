import { cssTokens } from '@/generated-tokens';
import { getColorScheme, useColorScheme } from '@/hooks/useColorScheme';
import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
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
