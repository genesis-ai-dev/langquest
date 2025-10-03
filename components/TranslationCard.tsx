import { Card, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { LayerStatus } from '@/database_services/types';
import type { TranslationWithVoteCount } from '@/hooks/db/useTranslations';
import type { WithSource } from '@/utils/dbUtils';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { cn } from '@/utils/styleUtils';
import { ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import AudioPlayer from './AudioPlayer';

interface TranslationCardProps {
  translation: WithSource<TranslationWithVoteCount>;
  previewText: string;
  audioUri: string | undefined;
  handleTranslationPress: (id: string) => void;
}

export const TranslationCard = ({
  translation,
  audioUri = undefined,
  handleTranslationPress,
  previewText
}: TranslationCardProps) => {
  const currentLayer = useStatusContext();
  const { allowEditing, invisible } = currentLayer.getStatusParams(
    LayerType.ASSET,
    translation.id || '',
    translation as LayerStatus
  );

  return (
    <View className="flex flex-col gap-4">
      <Pressable
        key={translation.id}
        onPress={() => handleTranslationPress(translation.id)}
        disabled={!allowEditing}
      >
        <Card
          className={cn(
            !allowEditing && 'opacity-50',
            invisible && 'opacity-20'
          )}
        >
          <CardHeader className="flex flex-row items-start justify-between">
            <View className="flex flex-1 flex-col gap-2">
              <View className="flex flex-row items-start gap-2">
                <Text numberOfLines={2} className="flex flex-1">
                  {previewText}
                </Text>
              </View>

              {/* Audio Player */}
              {translation.audio && audioUri && (
                <View className="rounded-sm bg-background p-2">
                  <AudioPlayer
                    audioUri={audioUri}
                    useCarousel={false}
                    mini={true}
                  />
                </View>
              )}

              {SHOW_DEV_ELEMENTS && (
                <Text className="text-xs text-muted-foreground">
                  {`${translation.source === 'cloud' ? '🌐 Cloud' : '💾 Offline'} - V: ${translation.visible ? '🟢' : '🔴'} | A: ${translation.active ? '🟢' : '🔴'}`}
                </Text>
              )}
            </View>

            <View className="flex flex-col items-end gap-1">
              <View className="flex flex-row items-center gap-2">
                <Icon
                  as={ThumbsUpIcon}
                  size={16}
                  className={cn(
                    'text-foreground',
                    translation.up_votes > 0 ? 'opacity-100' : 'opacity-30'
                  )}
                />
                <Text className="text-sm font-bold">
                  {translation.net_votes}
                </Text>
                <Icon
                  as={ThumbsDownIcon}
                  size={16}
                  className={cn(
                    'text-foreground',
                    translation.down_votes > 0 ? 'opacity-100' : 'opacity-30'
                  )}
                />
              </View>
              {SHOW_DEV_ELEMENTS && (
                <Text className="text-xs text-muted-foreground">
                  {translation.up_votes} ↑ {translation.down_votes} ↓
                </Text>
              )}
            </View>
          </CardHeader>
        </Card>
      </Pressable>
    </View>
  );
};
