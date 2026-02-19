// You can explore Lucide icons at https://lucide.dev/

import { Icon } from '@/components/ui/icon';
import type { LucideIcon, LucideProps } from 'lucide-react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export function TabBarIcon({
  as,
  style,
  ...rest
}: { as: LucideIcon; style?: StyleProp<ViewStyle> } & LucideProps) {
  return (
    <Icon
      as={as}
      size={28}
      className="text-foreground"
      style={[{ marginBottom: -3 }, style]}
      {...rest}
    />
  );
}
