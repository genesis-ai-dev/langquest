import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { AssetResult } from '@/database_services/reviewService';
import { cn } from '@/utils/styleUtils';
import type { LucideIcon } from 'lucide-react-native';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleIcon
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

export const RESULT_ORDER: AssetResult[] = [
  'not_reviewed',
  'suggested_changes',
  'approved'
];

export const RESULT_LABEL: Record<AssetResult, string> = {
  not_reviewed: 'No status',
  suggested_changes: 'Suggested Changes',
  approved: 'Approved'
};

const RESULT_OPTION_CLASS: Record<AssetResult, string> = {
  not_reviewed: 'bg-transparent',
  suggested_changes: 'border-transparent bg-yellow-500',
  approved: 'border-transparent bg-green-500'
};

const RESULT_OPTION_TEXT_CLASS: Record<AssetResult, string> = {
  not_reviewed: 'text-muted-foreground',
  suggested_changes: 'text-black',
  approved: 'text-white'
};

const RESULT_ICON: Record<AssetResult, LucideIcon> = {
  not_reviewed: CircleIcon,
  suggested_changes: CircleAlertIcon,
  approved: CircleCheckIcon
};

const RESULT_ICON_CLASS: Record<AssetResult, string> = {
  not_reviewed: 'text-muted-foreground/50',
  suggested_changes: 'text-yellow-500',
  approved: 'text-green-500'
};

export function ResultIcon({
  result,
  size = 26
}: {
  result: AssetResult;
  size?: number;
}) {
  return (
    <Icon
      as={RESULT_ICON[result]}
      size={size}
      className={RESULT_ICON_CLASS[result]}
    />
  );
}

const RESULT_SOFT_BADGE_CLASS: Record<AssetResult, string> = {
  not_reviewed: 'border-dashed border-border bg-muted/40',
  suggested_changes: 'border-yellow-500/40 bg-yellow-500/15',
  approved: 'border-green-500/40 bg-green-500/15'
};

const RESULT_SOFT_TEXT_CLASS: Record<AssetResult, string> = {
  not_reviewed: 'text-muted-foreground',
  suggested_changes: 'text-yellow-700 dark:text-yellow-400',
  approved: 'text-green-700 dark:text-green-400'
};

/** Tinted badge for a status that is still a draft (not submitted). */
export function ResultSoftBadge({ result }: { result: AssetResult }) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1',
        RESULT_SOFT_BADGE_CLASS[result]
      )}
    >
      <Icon
        as={RESULT_ICON[result]}
        size={14}
        className={RESULT_SOFT_TEXT_CLASS[result]}
      />
      <Text
        className={cn('text-xs font-medium', RESULT_SOFT_TEXT_CLASS[result])}
      >
        {RESULT_LABEL[result]}
      </Text>
    </View>
  );
}

export function ResultOptions({
  result,
  onSelect
}: {
  result: AssetResult;
  onSelect: (result: AssetResult) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {RESULT_ORDER.map((value) => {
        const isSelected = value === result;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            className={cn(
              'min-h-10 flex-1 items-center justify-center rounded-md border border-border px-2 py-2',
              RESULT_OPTION_CLASS[value],
              isSelected && 'border-2 border-foreground'
            )}
          >
            <Text
              className={cn(
                'text-center text-sm font-medium',
                RESULT_OPTION_TEXT_CLASS[value]
              )}
              numberOfLines={2}
            >
              {RESULT_LABEL[value]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
