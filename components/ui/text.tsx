import { cn, useNotoSans } from '@/utils/styleUtils';
import * as Slot from '@rn-primitives/slot';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import type { Role } from 'react-native';
import { Platform, Text as RNText } from 'react-native';

const textVariants = cva(
  cn(
    'text-foreground',
    Platform.select({
      web: 'select-text'
    })
  ),
  {
    variants: {
      variant: {
        default: 'text-base',
        h1: cn(
          'text-center text-4xl font-extrabold tracking-tight',
          Platform.select({ web: 'scroll-m-20 text-balance' })
        ),
        h2: cn(
          'border-b border-border pb-2 text-3xl font-semibold tracking-tight',
          Platform.select({ web: 'scroll-m-20 first:mt-0' })
        ),
        h3: cn(
          'text-2xl font-semibold tracking-tight',
          Platform.select({ web: 'scroll-m-20' })
        ),
        h4: cn(
          'text-xl font-semibold tracking-tight',
          Platform.select({ web: 'scroll-m-20' })
        ),
        p: 'mt-3 leading-7 sm:mt-6',
        blockquote: 'mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6',
        code: cn(
          'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold'
        ),
        lead: 'text-xl text-muted-foreground',
        large: 'text-lg font-semibold',
        small: 'text-sm font-medium leading-none',
        muted: 'text-sm text-muted-foreground'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role })
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4'
};

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof RNText> &
  TextVariantProps &
  React.RefAttributes<RNText> & {
    asChild?: boolean;
  }) {
  const textClass = React.useContext(TextClassContext);
  const mergedClassName = cn(textVariants({ variant }), textClass, className);
  const { style, ...restProps } = props;
  const notoSansStyle = useNotoSans(mergedClassName, style);

  // Render directly as RNText to avoid Slot navigation context issues during transitions
  // Only use Slot.Text when explicitly using asChild pattern
  if (!asChild) {
    return (
      <RNText
        className={mergedClassName}
        role={variant ? ROLE[variant] : undefined}
        aria-level={variant ? ARIA_LEVEL[variant] : undefined}
        style={notoSansStyle}
        {...restProps}
      />
    );
  }

  return (
    <Slot.Text
      className={mergedClassName}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      style={notoSansStyle}
      {...restProps}
    />
  );
}

export { Text, TextClassContext };
