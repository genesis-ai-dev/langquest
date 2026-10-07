import {
  FeedbackTextScroll,
  ReviewAssetResultCard
} from '@/components/ReviewAssetResultCard';
import {
  OVERALL_FEEDBACK_AUDIO_ID,
  ReviewAudioPlayButton
} from '@/components/ReviewAudioPlayButton';
import {
  ReviewAudioPlayer,
  ReviewAudioPlayerSpacer
} from '@/components/ReviewAudioPlayer';
import { ResultBadge } from '@/components/ReviewResult';
import { ReviewSettingsMenu } from '@/components/ReviewSettingsMenu';
import { LegendList } from '@/components/ui/legend-list';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { createQuestVersionFromQuest } from '@/database_services/questService';
import { setReviewActive } from '@/database_services/reviewService';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useReviewAccess } from '@/hooks/useReviewAccess';
import {
  EMPTY_ASSET_CONTENT,
  useReviewQuestAssets
} from '@/hooks/useReviewEditor';
import type { ReviewAssetResult, ReviewResult } from '@/hooks/useReviewResult';
import { useReviewResult } from '@/hooks/useReviewResult';
import { formatRelativeDate } from '@/utils/dateUtils';
import { cn } from '@/utils/styleUtils';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

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
  const hasAudio = result.audio.length > 0;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="font-semibold">Overall Feedback</Text>
        <ResultBadge result={result.questResult ?? 'not_reviewed'} />
      </View>

      {conclusion || hasAudio ? (
        <FeedbackTextScroll
          text={conclusion || 'Audio feedback only'}
          muted={!conclusion}
          className="rounded-md border border-border bg-card"
          accessory={
            <ReviewAudioPlayButton
              size="icon-sm"
              audioId={OVERALL_FEEDBACK_AUDIO_ID}
              audioValues={result.audio}
            />
          }
        />
      ) : (
        <Text className="text-sm italic text-muted-foreground">
          No overall feedback
        </Text>
      )}
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
  const { currentUser } = useAuth();
  const { goToQuest } = useNavigationHelpers();
  const queryClient = useQueryClient();
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const { canManageReview } = useReviewAccess();

  const createVersion = async () => {
    if (!currentUser?.id || isCreatingVersion) return;
    setIsCreatingVersion(true);
    try {
      const created = await createQuestVersionFromQuest({
        sourceQuestId: questId,
        userId: currentUser.id,
        reviewId
      });
      await queryClient.invalidateQueries({ queryKey: ['bible-chapters'] });
      await queryClient.invalidateQueries({
        queryKey: ['fia-pericope-quests']
      });
      await queryClient.invalidateQueries({ queryKey: ['quests'] });
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      goToQuest({
        id: created.questId,
        project_id: created.projectId,
        name: created.questName,
        promptVersionLabel: true
      });
    } catch (error) {
      console.error('Failed to create quest version from review:', error);
      Alert.alert('Could not start editing');
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const toggleActive = async (active: boolean) => {
    if (isTogglingActive) return;
    setIsTogglingActive(true);
    try {
      await setReviewActive(reviewId, active);
      await queryClient.invalidateQueries({
        queryKey: ['review-result', reviewId]
      });
      await queryClient.invalidateQueries({ queryKey: ['reviews'] });
    } catch (error) {
      console.error('Failed to update review active state:', error);
      Alert.alert('Could not update the review');
    } finally {
      setIsTogglingActive(false);
    }
  };

  const confirmToggleActive = () => {
    if (!result) return;
    if (!result.active) {
      void toggleActive(true);
      return;
    }
    Alert.alert(
      'Inactivate review',
      'Only you and the project owners will see this review in the lists.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Inactivate',
          style: 'destructive',
          onPress: () => void toggleActive(false)
        }
      ]
    );
  };

  const confirmCreateVersion = () => {
    Alert.alert(
      'Edit from Review',
      'Edit this quest into a new version using the review feedback.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Editing', onPress: () => void createVersion() }
      ]
    );
  };

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
      <View className="flex-1 px-4">
        <View
          className="z-50 flex-row items-start justify-between gap-3"
          style={{ elevation: 50 }}
        >
          <View
            className={cn('min-w-0 flex-1', !result.active && 'opacity-50')}
          >
            <Text variant="h4">Review</Text>
            <Text className="text-sm text-muted-foreground">
              {subjectName ?? result.questLabel}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {creator} · {formatRelativeDate(result.date)}
            </Text>
          </View>
          {isCreatingVersion || isTogglingActive ? (
            <View className="size-10 items-center justify-center">
              <ActivityIndicator />
            </View>
          ) : (
            <ReviewSettingsMenu
              active={result.active}
              canManage={canManageReview(result)}
              onEdit={confirmCreateVersion}
              onToggleActive={confirmToggleActive}
            />
          )}
        </View>

        <LegendList
          style={{ flex: 1 }}
          data={assets}
          keyExtractor={(item) => item.id}
          estimatedItemSize={96}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <View className="gap-6 pb-6 pt-6">
              <OverallFeedbackResult result={result} />
              <Text variant="h4">Assets</Text>
            </View>
          }
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
