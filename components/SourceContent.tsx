import { Text } from '@/components/ui/text';
import type { asset_content_link } from '@/db/drizzleSchema';
import { useLocalization } from '@/hooks/useLocalization';
import { getThemeColor } from '@/utils/styleUtils';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import MiniAudioPlayer from './MiniAudioPlayer';

interface SourceContentProps {
  content: typeof asset_content_link.$inferSelect;
  audioSegments?: string[] | null;
  isLoading?: boolean;
  onTranscribe?: (uri: string) => void;
  isTranscribing?: boolean;
  showText?: boolean;
  maxTextHeight?: number;
}

export const SourceContent: React.FC<SourceContentProps> = ({
  content,
  audioSegments,
  isLoading = false,
  onTranscribe,
  isTranscribing = false,
  showText = true,
  maxTextHeight
}) => {
  const { t } = useLocalization();

  return (
    <View className="w-full gap-2 rounded bg-muted p-3">
      {showText && content.text ? (
        <ScrollView
          className="rounded bg-primary-foreground"
          style={{ maxHeight: maxTextHeight }}
          contentContainerStyle={{ padding: 12 }}
          showsVerticalScrollIndicator
        >
          <Text className="text-base leading-relaxed text-foreground">
            {content.text}
          </Text>
        </ScrollView>
      ) : null}

      {audioSegments?.length || (content.audio?.length && isLoading) ? (
        <View className="w-full items-center justify-center">
          {audioSegments?.length ? (
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
