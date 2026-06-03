import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import { Platform, View } from 'react-native';

/** Matches NEW badge on asset list cards (`AssetCardItem`). */
export function NewHighlightBadge({ className }: { className?: string }) {
  return (
    <TextClassContext.Provider value={undefined}>
      <View
        className={cn(
          'rounded-lg bg-primary/50 px-2',
          Platform.OS === 'android' && 'items-center justify-center py-0.5',
          className
        )}
      >
        <Text
          className={cn(
            'text-[10px] font-semibold text-white',
            Platform.OS === 'android' && 'leading-none'
          )}
          {...(Platform.OS === 'android' && { includeFontPadding: false })}
        >
          NEW
        </Text>
      </View>
    </TextClassContext.Provider>
  );
}
