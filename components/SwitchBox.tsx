import { cn } from '@/utils/styleUtils';
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { Icon } from './ui/icon';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Text } from './ui/text';

interface SwitchBoxProps {
  title: string;
  description: string;
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
}

export function SwitchBox({
  title,
  description,
  value,
  onChange,
  disabled = false,
  icon: IconComponent
}: SwitchBoxProps) {
  return (
    <View className="py-3">
      <View className="flex-row items-center justify-between">
        <View className="mr-4 flex-1">
          <View className="flex-row items-center gap-3">
            {IconComponent && (
              <Icon
                as={IconComponent}
                size={20}
                className={cn(
                  'text-muted-foreground',
                  disabled && 'opacity-60'
                )}
              />
            )}
            <Label className={cn(disabled && 'opacity-60')}>{title}</Label>
          </View>
          <Text
            className={cn(
              'mt-1 text-sm text-muted-foreground',
              disabled && 'opacity-60'
            )}
          >
            {description}
          </Text>
        </View>
        <Switch
          checked={value}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      </View>
    </View>
  );
}
