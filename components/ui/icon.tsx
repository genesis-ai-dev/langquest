import { cssTokens } from '@/generated-tokens';
import { cn, useThemeColor, useThemeToken } from '@/utils/styleUtils';
import { Lucide, type LucideIconName } from '@react-native-vector-icons/lucide';
import type { MotiProps } from 'moti';
import { useMotify } from 'moti';
import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
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
 * Extracts theme-aware tokens from a className string.
 *
 * - `text-*` classes matching a CSS token → `colorToken`
 *   (e.g., `text-destructive` → `destructive`)
 * - `size-*` classes → `sizePixels` converted via Tailwind scale
 *   (e.g., `size-8` → 32, `size-5` → 20, `size-0.5` → 2)
 * - Arbitrary `size-[Npx]` → `sizePixels` as-is
 *   (e.g., `size-[18px]` → 18)
 *
 * Non-matching classes are left untouched in className.
 */
function extractIconTokens(className?: string) {
  if (!className) return { colorToken: null, sizePixels: null };

  const classes = className.split(/\s+/);
  let colorToken: string | null = null;
  let sizePixels: number | null = null;

  for (const cls of classes) {
    // text-* theme color tokens (e.g., text-destructive → destructive)
    const colorMatch = cls.match(/^text-(.+)$/);
    if (
      colorMatch?.[1] &&
      !colorToken &&
      `--${colorMatch[1]}` in cssTokens.light
    ) {
      colorToken = colorMatch[1];
      continue;
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

  return { colorToken, sizePixels };
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
 * - `text-*` theme tokens → `color` prop via `useThemeColor`
 *   (e.g., `text-destructive`, `text-muted-foreground`)
 * - `size-*` classes → `size` prop via Tailwind scale (1 unit = 4px)
 *   (e.g., `size-8` → 32px, `size-[18px]` → 18px)
 *
 * Explicit `color` and `size` props always take precedence over className parsing.
 *
 * @component
 * @example
 * ```tsx
 * import { Icon } from '@/components/ui/icon';
 *
 * // Color and size via className
 * <Icon name="trash-2" className="text-destructive size-5" />
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
  const { colorToken, sizePixels } = extractIconTokens(mergedClassName);
  const themeColor = useThemeColor(
    (colorToken ?? 'foreground') as Parameters<typeof useThemeColor>[0]
  );
  const defaultSize = Number(useThemeToken('default-icon-size'));

  return (
    <IconImpl
      name={name}
      className={mergedClassName}
      size={size ?? sizePixels ?? defaultSize}
      color={color ?? themeColor}
      {...props}
    />
  );
}

function MotiIcon({ name, className, size, color, ...props }: IconProps) {
  const textClass = React.useContext(TextClassContext);
  const mergedClassName = cn(textClass, className);
  const { colorToken, sizePixels } = extractIconTokens(mergedClassName);
  const themeColor = useThemeColor(
    (colorToken ?? 'foreground') as Parameters<typeof useThemeColor>[0]
  );
  const defaultSize = Number(useThemeToken('default-icon-size'));

  return (
    <MotiIconImpl
      name={name}
      className={mergedClassName}
      size={size ?? sizePixels ?? defaultSize}
      color={color ?? themeColor}
      {...props}
    />
  );
}

export { Icon, MotiIcon };
export type { LucideIconName };
