import {
  getFeedbackAudioId,
  getSourceAudioId,
  ReviewAudioPlayButton
} from '@/components/ReviewAudioPlayButton';
import { ResultBadge } from '@/components/ReviewResult';
import { Text } from '@/components/ui/text';
import type { AssetResult } from '@/database_services/reviewService';
import { cn } from '@/utils/styleUtils';
import { View } from 'react-native';

export interface ReviewAssetResultCardProps {
  assetId: string;
  name: string;
  sourceAudio: string[];
  result: AssetResult;
  comment: string | null;
  audio: string[];
}

export function ReviewAssetResultCard({
  assetId,
  name,
  sourceAudio,
  result,
  comment,
  audio
}: ReviewAssetResultCardProps) {
  const trimmedComment = comment?.trim() ?? '';
  const hasFeedback = !!trimmedComment || audio.length > 0;

  return (
    <View className="gap-3 rounded-lg border border-border bg-card p-3">
      <View className="flex-row items-center gap-2">
        <ReviewAudioPlayButton
          audioId={getSourceAudioId(assetId)}
          audioValues={sourceAudio}
        />
        <Text className="min-w-0 flex-1 font-semibold" numberOfLines={1}>
          {name}
        </Text>
        <ResultBadge result={result} />
      </View>

      {hasFeedback ? (
        <View className="flex-row items-start gap-2 rounded-md bg-muted p-3">
          <Text
            className={cn(
              'flex-1 text-sm',
              !trimmedComment && 'italic text-muted-foreground'
            )}
          >
            {trimmedComment || 'Audio feedback only'}
          </Text>
          {audio.length > 0 ? (
            <ReviewAudioPlayButton
              size="icon-sm"
              audioId={getFeedbackAudioId(assetId)}
              audioValues={audio}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
