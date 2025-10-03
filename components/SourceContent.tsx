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
}

export const SourceContent: React.FC<SourceContentProps> = ({
  content,
  sourceLanguage,
  audioSegments,
  isLoading = false
}) => {
  const { t } = useLocalization();

  return (
    <View className="flex max-h-[300px] flex-col gap-4">
      <ScrollView className="flex-1">
        <View className="flex flex-col gap-2">
          <Text className="text-base font-bold">
            {sourceLanguage?.native_name || sourceLanguage?.english_name}
          </Text>
          <Text className="text-base">{content.text}</Text>
        </View>
      </ScrollView>
      {content.audio && audioSegments ? (
        <MiniAudioPlayer
          audioSegments={audioSegments}
          id={content.id}
          title={content.text}
        />
      ) : content.audio && isLoading ? (
        <View className="flex flex-row items-center justify-center gap-2">
          <ActivityIndicator size="small" color={getThemeColor('primary')} />
          <Text className="text-muted-foreground">{t('loadingAudio')}</Text>
        </View>
      ) : null}
    </View>
  );
};
