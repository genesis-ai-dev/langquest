import { ReviewAssetResultCard } from '@/components/ReviewAssetResultCard';
import {
  OVERALL_FEEDBACK_AUDIO_ID,
  ReviewAudioPlayButton
} from '@/components/ReviewAudioPlayButton';
import {
  ReviewAudioPlayer,
  ReviewAudioPlayerSpacer
} from '@/components/ReviewAudioPlayer';
import { ResultBadge } from '@/components/ReviewResult';
import { LegendList } from '@/components/ui/legend-list';
import { Text } from '@/components/ui/text';
import { EMPTY_ASSET_CONTENT, useReviewQuestAssets } from '@/hooks/useReviewEditor';
import type { ReviewAssetResult, ReviewResult } from '@/hooks/useReviewResult';
import { useReviewResult } from '@/hooks/useReviewResult';
import { formatRelativeDate } from '@/utils/dateUtils';
import { ActivityIndicator, View } from 'react-native';

interface ReviewResultViewProps {
  questId: string;
  reviewId: string;
  subjectName?: string;
}

const NOT_REVIEWED: ReviewAssetResult = {
  asset_result: 'not_reviewed',
  comment: null,
  audio: []
};

function OverallFeedbackResult({ result }: { result: ReviewResult }) {
  const conclusion = result.conclusion?.trim();

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="font-semibold">Overall Feedback</Text>
        <ResultBadge result={result.questResult ?? 'not_reviewed'} />
      </View>

      {conclusion ? <Text className="text-sm">{conclusion}</Text> : null}

      {result.audio.length > 0 ? (
        <View className="flex-row items-center gap-2">
          <ReviewAudioPlayButton
            size="icon-sm"
            audioId={OVERALL_FEEDBACK_AUDIO_ID}
            audioValues={result.audio}
          />
          <Text className="flex-1 text-sm">Audio feedback</Text>
        </View>
      ) : null}

      {!conclusion && result.audio.length === 0 ? (
        <Text className="text-sm italic text-muted-foreground">
          No overall feedback
        </Text>
      ) : null}
    </View>
  );
}

export default function ReviewResultView({
  questId,
  reviewId,
  subjectName
}: ReviewResultViewProps) {
  const { result, isLoading } = useReviewResult(reviewId);
  const {
    assets,
    contentByAsset,
    isLoading: isAssetsLoading
  } = useReviewQuestAssets(questId);

  const assetNames = new Map(assets.map((item) => [item.id, item.name ?? '']));

  if (isLoading || isAssetsLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!result) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-muted-foreground">Review not found</Text>
      </View>
    );
  }

  const creator = result.creatorName.trim() || 'Unknown';

  return (
    <View className="flex-1">
      <View className="flex-1 gap-6 px-4">
        <View className="min-w-0">
          <Text variant="h4">Review</Text>
          <Text className="text-sm text-muted-foreground">
            {subjectName ?? result.questLabel}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {creator} · {formatRelativeDate(result.date)}
          </Text>
        </View>

        <OverallFeedbackResult result={result} />
        <Text variant="h4">Assets</Text>

        <LegendList
          data={assets}
          keyExtractor={(item) => item.id}
          estimatedItemSize={96}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const assetResult = result.assets.get(item.id) ?? NOT_REVIEWED;
            return (
              <ReviewAssetResultCard
                assetId={item.id}
                name={item.name ?? ''}
                sourceAudio={
                  (contentByAsset.get(item.id) ?? EMPTY_ASSET_CONTENT).audio
                }
                result={assetResult.asset_result}
                comment={assetResult.comment}
                audio={assetResult.audio}
              />
            );
          }}
          ListFooterComponent={
            <ReviewAudioPlayerSpacer assetNames={assetNames} />
          }
        />
      </View>
      <ReviewAudioPlayer assetNames={assetNames} />
    </View>
  );
}
