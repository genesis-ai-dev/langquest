import { DownloadIndicator } from '@/components/DownloadIndicator';
import { ResultBadge } from '@/components/ReviewResult';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { AssetResult } from '@/database_services/reviewService';
import { formatRelativeDate } from '@/utils/dateUtils';
import { cn } from '@/utils/styleUtils';
import { PencilLineIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

export type ReviewStatus = 'draft' | 'published';
export type ReviewOutcome = 'suggested-changes' | 'approved';

interface ReviewCardBaseProps {
  title: string;
  creatorName: string;
  date: string;
  origin: string;
  reviewLabel?: string | null;
  /** Cloud-only review: rendered translucent with a download action. */
  needsDownload?: boolean;
  isDownloading?: boolean;
  onDownloadPress?: () => void;
  className?: string;
}

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

const OUTCOME_RESULT: Record<ReviewOutcome, AssetResult> = {
  'suggested-changes': 'suggested_changes',
  approved: 'approved'
};

function DraftBadge() {
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-full border border-border bg-muted px-2.5 py-1">
      <Icon as={PencilLineIcon} size={14} className="text-muted-foreground" />
      <Text className="text-xs font-medium text-muted-foreground">Draft</Text>
    </View>
  );
}

export function ReviewCard({
  title,
  creatorName,
  date,
  origin,
  reviewLabel,
  status,
  outcome,
  needsDownload = false,
  isDownloading = false,
  onDownloadPress,
  className
}: ReviewCardProps) {
  const displayCreator = creatorName.trim() || 'Unknown';
  const isDraft = status === 'draft';

  return (
    <View
      className={cn(
        'flex-row items-center gap-3 rounded-lg border border-border bg-card p-4',
        needsDownload && 'opacity-60',
        className
      )}
    >
      <View
        className={cn(
          'h-10 w-10 items-center justify-center rounded-full',
          isDraft ? 'bg-chart-2' : needsDownload ? 'bg-muted' : 'bg-primary'
        )}
      >
        <Text
          className={cn(
            'font-semibold',
            isDraft || needsDownload
              ? 'text-secondary-foreground'
              : 'text-primary-foreground'
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
        </View>
        <View className="py-0.5">
          {isDraft ? (
            <DraftBadge />
          ) : (
            <ResultBadge result={OUTCOME_RESULT[outcome]} />
          )}
        </View>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          {displayCreator} · {formatRelativeDate(date)}
        </Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          {reviewLabel ? `${reviewLabel} · ${origin}` : origin}
        </Text>
      </View>

      {needsDownload && onDownloadPress ? (
        <DownloadIndicator
          isFlaggedForDownload={false}
          isLoading={isDownloading}
          onPress={onDownloadPress}
          size={18}
        />
      ) : null}
    </View>
  );
}
