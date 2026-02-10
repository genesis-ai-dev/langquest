import { Icon } from '@/components/ui/icon';
import type { LucideIconName } from '@react-native-vector-icons/lucide';
import type { TextProps } from 'react-native';

export function TabBarIcon({
  name,
  style,
  ...rest
}: { name: LucideIconName } & TextProps) {
  return <Icon name={name} size={28} style={[{ marginBottom: -3 }, style]} {...rest} />;
}
