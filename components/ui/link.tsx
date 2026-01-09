import { cn } from '@/utils/styleUtils';
import type { LinkProps } from 'expo-router';
import { Link as NativeLink } from 'expo-router';
import type { TextProps } from 'react-native';
import { buttonTextVariants } from './button';
import { Text } from './text';

export function Link({
  className,
  href,
  linkClassName,
  ...props
}: Omit<LinkProps, 'className'> & { linkClassName?: string } & TextProps) {
  return (
    <NativeLink href={href} className={linkClassName}>
      <Text
        {...props}
        className={cn(buttonTextVariants({ variant: 'link' }), className)}
      />
    </NativeLink>
  );
}
