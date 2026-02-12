import { cssTokens } from '@/generated-tokens';
import { cn, useThemeColor, useThemeToken } from '@/utils/styleUtils';
import { Lucide, type LucideIconName } from '@react-native-vector-icons/lucide';
import type { MotiProps } from 'moti';
import { useMotify } from 'moti';
import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import twColors from 'tailwindcss/colors';
import { TextClassContext } from './text';

type BaseIconProps = TextProps & {
  name: LucideIconName;
  size?: number;
  color?: TextStyle['color'];
  className?: string;
};

type IconProps = MotiProps<BaseIconProps> & BaseIconProps;

/** Tailwind default spacing scale: 1 unit = 4px. */
const TW_SCALE = 4;

/**
 * Resolves a Tailwind palette color from a `text-*` class value.
 *
 * Handles shaded colors (e.g., `green-600` → `#16a34a`) and
 * flat colors (e.g., `black` → `#000`, `white` → `#fff`).
 */
function resolveTailwindColor(name: string): string | null {
  // Shaded palette color (e.g., green-600, red-500)
  const shadeMatch = name.match(/^([a-z]+)-(\d+)$/);
  const colorName = shadeMatch?.[1];
  const shade = shadeMatch?.[2];
  if (colorName && shade) {
    const palette = twColors[colorName as keyof typeof twColors];
    if (palette && typeof palette === 'object' && shade in palette) {
      const hex = (palette as Record<string, string>)[shade];
      if (hex) return hex;
    }
  }

  // Flat color (e.g., black, white)
  if (name in twColors) {
    const val = twColors[name as keyof typeof twColors];
    if (typeof val === 'string') return val;
  }

  return null;
}

/**
 * Extracts theme-aware tokens from a className string.
 *
 * **Color** (`text-*`):
 * - Theme CSS tokens → `colorToken` resolved via `useThemeColor`
 *   (e.g., `text-destructive` → `destructive`)
 * - Tailwind palette colors → `twColor` resolved from `tailwindcss/colors`
 *   (e.g., `text-green-600` → `#16a34a`)
 *
 * **Size** (`size-*`):
 * - Scale values → pixels via Tailwind scale (1 unit = 4px)
 *   (e.g., `size-8` → 32, `size-5` → 20, `size-0.5` → 2)
 * - Arbitrary values → pixels as-is
 *   (e.g., `size-[18px]` → 18)
 */
function extractIconTokens(className?: string) {
  if (!className) return { colorToken: null, twColor: null, sizePixels: null };

  const classes = className.split(/\s+/);
  let colorToken: string | null = null;
  let twColor: string | null = null;
  let sizePixels: number | null = null;

  for (const cls of classes) {
    // text-* color classes
    const colorMatch = cls.match(/^text-(.+)$/);
    if (colorMatch?.[1] && !colorToken && !twColor) {
      const name = colorMatch[1];

      // 1. Theme CSS token (e.g., text-destructive → useThemeColor)
      if (`--${name}` in cssTokens.light) {
        colorToken = name;
        continue;
      }

      // 2. Tailwind palette color (e.g., text-green-600 → #16a34a)
      const resolved = resolveTailwindColor(name);
      if (resolved) {
        twColor = resolved;
        continue;
      }
    }

    // size-N scale values (e.g., size-8 → 32px, size-0.5 → 2px)
    const sizeMatch = cls.match(/^size-(\d+(?:\.\d+)?)$/);
    if (sizeMatch?.[1] && sizePixels === null) {
      sizePixels = Number(sizeMatch[1]) * TW_SCALE;
      continue;
    }

    // Arbitrary size values (e.g., size-[18px] → 18)
    const arbMatch = cls.match(/^size-\[(\d+(?:\.\d+)?)px\]$/);
    if (arbMatch?.[1] && sizePixels === null) {
      sizePixels = Number(arbMatch[1]);
    }
  }

  return { colorToken, twColor, sizePixels };
}

const MotiIconImpl = React.forwardRef<
  React.ComponentRef<typeof Text>,
  IconProps
>(function MotiIconImpl(
  { name, size, color, className, style, ...props },
  ref
) {
  const animated = useMotify<BaseIconProps>(props);

  return (
    <Lucide
      name={name}
      size={size}
      color={color}
      style={[animated.style, style]}
      className={className}
      innerRef={ref}
      {...props}
    />
  );
});

const IconImpl = React.forwardRef<React.ComponentRef<typeof Text>, IconProps>(
  function IconImpl({ name, size, color, className, style, ...props }, ref) {
    return (
      <Lucide
        name={name}
        size={size}
        color={color}
        style={style}
        className={className}
        innerRef={ref}
        {...props}
      />
    );
  }
);

/**
 * A wrapper component for Lucide icons with theme-aware color and size defaults.
 *
 * Parses className to automatically resolve:
 * - `text-*` theme tokens → `color` via `useThemeColor`
 *   (e.g., `text-destructive`, `text-muted-foreground`)
 * - `text-*` Tailwind palette colors → `color` via `tailwindcss/colors`
 *   (e.g., `text-green-600` → `#16a34a`, `text-red-500` → `#ef4444`)
 * - `size-*` classes → `size` via Tailwind scale (1 unit = 4px)
 *   (e.g., `size-8` → 32px, `size-[18px]` → 18px)
 *
 * Explicit `color` and `size` props always take precedence over className parsing.
 *
 * **Color priority:** explicit `color` prop → Tailwind palette → theme token → foreground default.
 *
 * @component
 * @example
 * ```tsx
 * import { Icon } from '@/components/ui/icon';
 *
 * // Theme token color + size via className
 * <Icon name="trash-2" className="text-destructive size-5" />
 *
 * // Tailwind palette color
 * <Icon name="circle-check" className="text-green-600" size={16} />
 *
 * // Explicit props take precedence
 * <Icon name="arrow-right" color={useThemeColor('primary')} size={16} />
 * ```
 *
 * @param {LucideIconName} name - The name of the Lucide icon to render.
 * @param {number} size - Icon size in pixels (defaults to className `size-*` or theme token).
 * @param {string} color - Explicit icon color (defaults to className `text-*` or foreground).
 * @param {string} className - Utility classes; `text-*` and `size-*` are extracted as props.
 * @param {...TextProps} ...props - Additional Text props passed to the icon.
 */
function Icon({ name, className, size, color, ...props }: IconProps) {
  const textClass = React.useContext(TextClassContext);
  const mergedClassName = cn(textClass, className);
  const { colorToken, twColor, sizePixels } =
    extractIconTokens(mergedClassName);
  const themeColor = useThemeColor(
    (colorToken ?? 'foreground') as Parameters<typeof useThemeColor>[0]
  );
  const defaultSize = Number(useThemeToken('default-icon-size'));

  return (
    <IconImpl
      name={name}
      className={mergedClassName}
      size={size ?? sizePixels ?? defaultSize}
      color={color ?? twColor ?? themeColor}
      {...props}
    />
  );
}

function MotiIcon({ name, className, size, color, ...props }: IconProps) {
  const textClass = React.useContext(TextClassContext);
  const mergedClassName = cn(textClass, className);
  const { colorToken, twColor, sizePixels } =
    extractIconTokens(mergedClassName);
  const themeColor = useThemeColor(
    (colorToken ?? 'foreground') as Parameters<typeof useThemeColor>[0]
  );
  const defaultSize = Number(useThemeToken('default-icon-size'));

  return (
    <MotiIconImpl
      name={name}
      className={mergedClassName}
      size={size ?? sizePixels ?? defaultSize}
      color={color ?? twColor ?? themeColor}
      {...props}
    />
  );
}

export { Icon, MotiIcon };
export type { LucideIconName };
