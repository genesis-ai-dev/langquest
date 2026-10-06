import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import { XIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

export interface MessageCardProps {
  title: string;
  subtitle: string;
  /** Runs when the card is pressed, outside the close button. Null does nothing. */
  onPress?: (() => void) | null;
  /** Runs after the card is dismissed. Null does nothing. */
  onClose?: (() => void) | null;
  className?: string;
}

export function MessageCard({
  title,
  subtitle,
  onPress,
  onClose,
  className
}: MessageCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleClose = () => {
    setDismissed(true);
    onClose?.();
  };

  return (
    <View
      data-slot="message-card"
      className={cn(
        'flex-row items-center gap-2 rounded-lg bg-primary/10 p-4 py-2',
        className
      )}
    >
      <Pressable
        className="min-w-0 flex-1"
        disabled={!onPress}
        onPress={onPress ?? undefined}
        accessibilityRole={onPress ? 'button' : undefined}
      >
        <Text className="text-sm font-bold leading-5" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm font-normal leading-5" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        className="flex h-8 w-8 items-center justify-center"
      >
        <Icon as={XIcon} size={16} className="text-foreground" />
      </Pressable>
    </View>
  );
}
