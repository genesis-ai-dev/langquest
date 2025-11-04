import { cn } from '@/utils/styleUtils';
import { View } from 'react-native';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Text } from './ui/text';

interface SwitchBoxProps {
  title: string;
  description: string;
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function SwitchBox({
  title,
  description,
  value,
  onChange,
  disabled = false
}: SwitchBoxProps) {
  return (
    <View className="border-b border-border py-4">
      <View className="flex-row items-center justify-between">
        <View className="mr-4 flex-1">
          <Label className={cn(disabled && 'opacity-60')}>{title}</Label>
          <Text
            className={cn(
              'text-sm text-muted-foreground',
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
