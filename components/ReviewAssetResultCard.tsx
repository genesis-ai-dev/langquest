import {
  getFeedbackAudioId,
  getSourceAudioId,
  ReviewAudioPlayButton
} from '@/components/ReviewAudioPlayButton';
import { ResultBadge } from '@/components/ReviewResult';
import { Text } from '@/components/ui/text';
import type { AssetResult } from '@/database_services/reviewService';
import { cn } from '@/utils/styleUtils';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

const FEEDBACK_BOX_HEIGHT = 120;

export function FeedbackTextScroll({
  text,
  muted = false,
  className,
  accessory
}: {
  text: string;
  muted?: boolean;
  className?: string;
  accessory?: ReactNode;
}) {
  const [scrollEnabled, setScrollEnabled] = useState(false);

  return (
    <View className="flex-row items-start gap-2">
      <View
        className={cn('min-w-0 flex-1 overflow-hidden', className)}
        style={
          scrollEnabled
            ? { height: FEEDBACK_BOX_HEIGHT }
            : { maxHeight: FEEDBACK_BOX_HEIGHT }
        }
      >
        <ScrollView
          nestedScrollEnabled
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={scrollEnabled}
          disallowInterruption={scrollEnabled}
          onContentSizeChange={(_width, height) => {
            const next = height > FEEDBACK_BOX_HEIGHT;
            setScrollEnabled((current) => (current === next ? current : next));
          }}
        >
          <View className="p-3">
            <Text
              className={cn(
                'text-sm leading-5',
                muted && 'italic text-muted-foreground'
              )}
            >
              {text}
            </Text>
          </View>
        </ScrollView>
      </View>
      {accessory}
    </View>
  );
}

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
        {result !== 'not_reviewed' ? <ResultBadge result={result} /> : null}
      </View>

      {hasFeedback ? (
        <View className="gap-1">
          <Text className="text-sm font-semibold">Feedback</Text>
          <FeedbackTextScroll
            text={trimmedComment || 'Audio feedback only'}
            muted={!trimmedComment}
            className="rounded-md bg-muted"
            accessory={
              <ReviewAudioPlayButton
                size="icon-sm"
                audioId={getFeedbackAudioId(assetId)}
                audioValues={audio}
              />
            }
          />
        </View>
      ) : null}
    </View>
  );
}
