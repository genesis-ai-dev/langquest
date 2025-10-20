/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Card, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { LayerStatus } from '@/database_services/types';
import type { AssetWithVoteCount } from '@/hooks/db/useTranslations';
import type { WithSource } from '@/utils/dbUtils';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { cn } from '@/utils/styleUtils';
import { ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import AudioPlayer from './AudioPlayer';

interface TranslationCardProps {
  asset: WithSource<AssetWithVoteCount>;
  previewText: string;
  audioSegments: string[] | undefined;
  handleTranslationPress: (id: string) => void;
}

export const TranslationCard = ({
  asset,
  audioSegments = [],
  handleTranslationPress,
  previewText
}: TranslationCardProps) => {
  const currentLayer = useStatusContext();
  const { allowEditing, invisible } = currentLayer.getStatusParams(
    LayerType.ASSET,
    asset.id || '',
    asset as LayerStatus
  );

  return (
    <View className="flex flex-col gap-4">
      <Pressable
        key={asset.id}
        onPress={() => handleTranslationPress(asset.id)}
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
              {asset.audio &&
                asset.audio.length > 0 &&
                audioSegments.length > 0 && (
                  <View className="rounded-sm bg-background p-2">
                    <AudioPlayer
                      audioSegments={audioSegments}
                      useCarousel={false}
                      mini={true}
                    />
                  </View>
                )}

              {SHOW_DEV_ELEMENTS && (
                <Text className="text-xs text-muted-foreground">
                  {asset.source === 'cloud' ? '🌐 Cloud' : '💾 Offline'} - V:{' '}
                  {asset.visible ? '🟢' : '🔴'} | A:{' '}
                  {asset.active ? '🟢' : '🔴'}
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
                    asset.up_votes > 0 ? 'opacity-100' : 'opacity-30'
                  )}
                />
                <Text className="text-sm font-bold">{asset.net_votes}</Text>
                <Icon
                  as={ThumbsDownIcon}
                  size={16}
                  className={cn(
                    'text-foreground',
                    asset.down_votes > 0 ? 'opacity-100' : 'opacity-30'
                  )}
                />
              </View>
              {SHOW_DEV_ELEMENTS && (
                <Text className="text-xs text-muted-foreground">
                  {asset.up_votes} ↑ {asset.down_votes} ↓
                </Text>
              )}
            </View>
          </CardHeader>
        </Card>
      </Pressable>
    </View>
  );
};
