import {
  getFeedbackAudioId,
  getSourceAudioId,
  ReviewAudioPlayButton
} from '@/components/ReviewAudioPlayButton';
import {
  RESULT_LABEL,
  ResultIcon,
  ResultOptions
} from '@/components/ReviewResult';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import type { AssetResult } from '@/database_services/reviewService';
import { useAutosaveText } from '@/hooks/useAutosaveText';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MicIcon,
  Trash2Icon
} from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

export interface ReviewAssetCardProps {
  assetId: string;
  name: string;
  verseLabel?: string | null;
  texts: string[];
  sourceAudio: string[];
  result: AssetResult;
  comment: string;
  audio: string | null;
  onResultChange: (result: AssetResult) => void;
  onCommentChange: (comment: string) => void;
  onRequestRecord: () => void;
  onRemoveAudio: () => void;
}

export function ReviewAssetCard({
  assetId,
  name,
  verseLabel,
  texts,
  sourceAudio,
  result,
  comment,
  audio,
  onResultChange,
  onCommentChange,
  onRequestRecord,
  onRemoveAudio
}: ReviewAssetCardProps) {
  const [isResultPickerOpen, setIsResultPickerOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const commentField = useAutosaveText(comment, onCommentChange);

  return (
    <View className="gap-2 rounded-lg border border-border bg-card p-3">
      <View className="flex-row items-center gap-2">
        <ReviewAudioPlayButton
          audioId={getSourceAudioId(assetId)}
          audioValues={sourceAudio}
        />
        <View className="min-w-0 flex-1 items-start gap-1">
          <Text className="font-semibold" numberOfLines={1}>
            {name}
          </Text>
          {verseLabel ? (
            <Badge variant="secondary">
              <Text className="text-[10px]">{verseLabel}</Text>
            </Badge>
          ) : null}
        </View>
        <Button
          variant="ghost"
          size="icon"
          accessibilityLabel={RESULT_LABEL[result]}
          onPress={() => setIsResultPickerOpen((open) => !open)}
        >
          <ResultIcon result={result} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          accessibilityLabel={
            isFeedbackOpen ? 'Hide feedback' : 'Show feedback'
          }
          onPress={() => setIsFeedbackOpen((open) => !open)}
        >
          <Icon
            as={isFeedbackOpen ? ChevronUpIcon : ChevronDownIcon}
            size={18}
          />
        </Button>
      </View>

      {isResultPickerOpen ? (
        <ResultOptions
          result={result}
          onSelect={(value) => {
            setIsResultPickerOpen(false);
            if (value !== result) onResultChange(value);
          }}
        />
      ) : null}

      {/* {texts.map((text, index) => (
        <Text key={index} className="text-sm text-muted-foreground">
          {text}
        </Text>
      ))} */}

      {isFeedbackOpen ? (
        <View className="gap-2 border-t border-border pt-3">
          <Text className="font-semibold">Feedback</Text>
          <Textarea
            drawerInput={false}
            placeholder="Comment"
            value={commentField.text}
            onChangeText={commentField.change}
            onBlur={commentField.flush}
          />

          {audio ? (
            <View className="flex-row items-center gap-2">
              <ReviewAudioPlayButton
                size="icon-sm"
                audioId={getFeedbackAudioId(assetId)}
                audioValues={[audio]}
              />
              <Text className="flex-1 text-sm">Audio feedback</Text>
              <Button
                variant="ghost"
                size="icon-sm"
                accessibilityLabel="Remove audio"
                onPress={onRemoveAudio}
              >
                <Icon as={Trash2Icon} size={16} className="text-destructive" />
              </Button>
            </View>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl border-primary"
              onPress={onRequestRecord}
            >
              <Icon as={MicIcon} size={16} className="text-primary" />
              <Text className="text-primary">Add audio</Text>
            </Button>
          )}
        </View>
      ) : null}
    </View>
  );
}
