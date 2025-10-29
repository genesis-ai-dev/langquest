/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Card, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { LayerStatus } from '@/database_services/types';
import type { AssetWithVoteCount } from '@/hooks/db/useTranslations';
import type { WithSource } from '@/utils/dbUtils';
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

  const hasAudio =
    asset.audio && asset.audio.length > 0 && audioSegments.length > 0;

  return (
    <Pressable
      onPress={() => handleTranslationPress(asset.id)}
      disabled={!allowEditing}
    >
      <Card
        className={cn(
          'transition-opacity',
          !allowEditing && 'opacity-50',
          invisible && 'opacity-20'
        )}
      >
        <CardHeader className="flex-row items-start justify-between gap-4">
          {/* Left side: Content */}
          <View className="flex-1 flex-col gap-3">
            {/* Text preview */}
            <Text
              numberOfLines={2}
              className="text-base leading-relaxed text-foreground"
            >
              {previewText}
            </Text>

            {/* Audio Player */}
            {hasAudio && (
              <View className="rounded-md border border-border bg-muted/30 p-3">
                <AudioPlayer
                  audioSegments={audioSegments}
                  useCarousel={false}
                  mini={true}
                />
              </View>
            )}

            {/* Dev info */}
            {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
            {__DEV__ && (
              <View className="flex-row items-center gap-2">
                <Text className="text-xs text-muted-foreground">
                  {asset.source === 'cloud' ? '🌐' : '💾'}
                </Text>
                <View className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <Text className="text-xs text-muted-foreground">
                  V: {asset.visible ? '🟢' : '🔴'}
                </Text>
                <View className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <Text className="text-xs text-muted-foreground">
                  A: {asset.active ? '🟢' : '🔴'}
                </Text>
              </View>
            )}
          </View>

          {/* Right side: Votes */}
          <View className="flex-col items-end justify-start gap-2">
            {/* Vote display */}
            <View className="flex-row items-center gap-1.5">
              <Icon
                as={ThumbsUpIcon}
                size={16}
                className={cn(
                  'text-muted-foreground/40',
                  asset.up_votes > 0 && 'text-green-700 dark:text-green-400'
                )}
              />
              <Text
                className={cn(
                  'min-w-[28px] text-center text-lg font-bold tabular-nums',
                  asset.net_votes > 0 && 'text-green-700 dark:text-green-400',
                  asset.net_votes < 0 && 'text-red-700 dark:text-red-400',
                  asset.net_votes === 0 && 'text-muted-foreground'
                )}
              >
                {asset.net_votes > 0 ? '+' : ''}
                {asset.net_votes}
              </Text>
              <Icon
                as={ThumbsDownIcon}
                size={16}
                className={cn(
                  'text-muted-foreground/40',
                  asset.down_votes > 0 && 'text-red-700 dark:text-red-400'
                )}
              />
            </View>

            {/* Dev vote breakdown */}
            {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
            {__DEV__ && (
              <Text className="text-xs text-muted-foreground/70">
                {asset.up_votes}↑ {asset.down_votes}↓
              </Text>
            )}
          </View>
        </CardHeader>
      </Card>
    </Pressable>
  );
};
