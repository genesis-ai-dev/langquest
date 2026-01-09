import { Text } from '@/components/ui/text';
import type { asset_content_link, language } from '@/db/drizzleSchema';
import { useLocalization } from '@/hooks/useLocalization';
import { getThemeColor } from '@/utils/styleUtils';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import MiniAudioPlayer from './MiniAudioPlayer';

interface SourceContentProps {
  content: typeof asset_content_link.$inferSelect;
  sourceLanguage: typeof language.$inferSelect | null;
  audioSegments?: string[] | null;
  isLoading?: boolean;
  onTranscribe?: (uri: string) => void;
  isTranscribing?: boolean;
}

export const SourceContent: React.FC<SourceContentProps> = ({
  content,
  sourceLanguage,
  audioSegments,
  isLoading = false,
  onTranscribe,
  isTranscribing = false
}) => {
  const { t } = useLocalization();

  return (
    <View className="flex h-[260px] max-h-[260px] flex-col items-center justify-center gap-4 rounded bg-muted p-2">
      {/* <ScrollView className="flex-1"> */}
      <Text className="text-base font-bold">
        {sourceLanguage?.native_name || sourceLanguage?.english_name}
      </Text>
      <View className="flex max-h-36 w-full flex-col gap-2 rounded bg-primary-foreground p-2">
        <ScrollView>
          <Text className="text-muted-foreground">{content.text}</Text>
        </ScrollView>
      </View>
      {/* </ScrollView> */}
      <View className="flex w-full items-center justify-center">
        {content.audio && audioSegments ? (
          <MiniAudioPlayer
            audioSegments={audioSegments}
            id={content.id}
            title={content.text ?? ''}
            onTranscribe={onTranscribe}
            isTranscribing={isTranscribing}
          />
        ) : content.audio && isLoading ? (
          <View className="flex flex-row items-center justify-center gap-2">
            <ActivityIndicator size="small" color={getThemeColor('primary')} />
            <Text className="text-muted-foreground">{t('loadingAudio')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};
