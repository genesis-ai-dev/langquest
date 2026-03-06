import { Text } from '@/components/ui/text';
import type { asset_content_link, languoid } from '@/db/drizzleSchema';
import { useLocalization } from '@/hooks/useLocalization';
import { getThemeColor } from '@/utils/styleUtils';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import MiniAudioPlayer from './MiniAudioPlayer';

interface SourceContentProps {
  content: typeof asset_content_link.$inferSelect;
  sourceLanguoid: typeof languoid.$inferSelect | null;
  audioSegments?: string[] | null;
  isLoading?: boolean;
  onTranscribe?: (uri: string) => void;
  isTranscribing?: boolean;
}

export const SourceContent: React.FC<SourceContentProps> = ({
  content,
  sourceLanguoid,
  audioSegments,
  isLoading = false,
  onTranscribe,
  isTranscribing = false
}) => {
  const { t } = useLocalization();

  return (
    <View className="flex h-[200px] flex-col items-center gap-2 rounded bg-muted p-3">
      {/* Language name header */}
      {sourceLanguoid && (
        <Text className="text-sm font-semibold text-muted-foreground">
          {sourceLanguoid.name}
        </Text>
      )}

      {/* Text content - scrollable */}
      <View className="w-full flex-1 rounded bg-primary-foreground p-3">
        <ScrollView
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <Text className="text-base leading-relaxed text-foreground">
            {content.text}
          </Text>
        </ScrollView>
      </View>

      {/* Audio player */}
      {(content.audio && audioSegments) || (content.audio && isLoading) ? (
        <View className="w-full items-center justify-center">
          {audioSegments ? (
            <MiniAudioPlayer
              audioSegments={audioSegments}
              id={content.id}
              title={content.text ?? ''}
              onTranscribe={onTranscribe}
              isTranscribing={isTranscribing}
            />
          ) : (
            <View className="flex-row items-center justify-center gap-2 py-2">
              <ActivityIndicator
                size="small"
                color={getThemeColor('primary')}
              />
              <Text className="text-muted-foreground">{t('loadingAudio')}</Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
};
