import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { formatRelativeDate } from '@/utils/dateUtils';
import { cn } from '@/utils/styleUtils';
import React from 'react';
import { View } from 'react-native';

export type ReviewStatus = 'draft' | 'published';
export type ReviewOutcome = 'suggested-changes' | 'approved';

type ReviewCardBaseProps = {
  title: string;
  creatorName: string;
  date: string;
  origin: string;
  className?: string;
};

export type ReviewCardProps = ReviewCardBaseProps &
  (
    | { status: 'draft'; outcome?: ReviewOutcome }
    | { status: 'published'; outcome: ReviewOutcome }
  );

function creatorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.charAt(0) ?? '';
  const last =
    parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

const BADGE_LABEL: Record<ReviewOutcome, string> = {
  'suggested-changes': 'Suggested Changes',
  approved: 'Approved'
};

export function ReviewCard({
  title,
  creatorName,
  date,
  origin,
  status,
  outcome,
  className
}: ReviewCardProps) {
  const displayCreator = creatorName.trim() || 'Unknown';
  const isDraft = status === 'draft';

  return (
    <View
      className={cn(
        'flex-row items-center gap-3 rounded-lg border border-border bg-card p-4',
        className
      )}
    >
      <View
        className={cn(
          'h-10 w-10 items-center justify-center rounded-full',
          isDraft ? 'bg-chart-2' : 'bg-primary'
        )}
      >
        <Text
          className={cn(
            'font-semibold',
            isDraft ? 'text-secondary-foreground' : 'text-primary-foreground'
          )}
        >
          {creatorInitials(displayCreator)}
        </Text>
      </View>

      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="min-w-0 flex-1 font-semibold" numberOfLines={1}>
            {title}
          </Text>
          {isDraft ? (
            <Badge variant="outline" className="bg-transparent">
              <Text className="text-muted-foreground">Draft</Text>
            </Badge>
          ) : (
            <Badge
              variant="default"
              className={cn(
                'border-transparent',
                outcome === 'suggested-changes'
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              )}
            >
              <Text
                className={
                  outcome === 'suggested-changes' ? 'text-black' : 'text-white'
                }
              >
                {BADGE_LABEL[outcome]}
              </Text>
            </Badge>
          )}
        </View>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          {displayCreator} · {formatRelativeDate(date)}
        </Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          {origin}
        </Text>
      </View>
    </View>
  );
}
