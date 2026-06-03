/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Card, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { LayerStatus } from '@/database_services/types';
import type { AssetWithVoteCount } from '@/hooks/db/useTranslations';
import { useLocalization } from '@/hooks/useLocalization';
import type { WithSource } from '@/utils/dbUtils';
import { SHOW_DEV_ELEMENTS } from '@/utils/featureFlags';
import { cn } from '@/utils/styleUtils';
import { ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { NewHighlightBadge } from '@/components/NewHighlightBadge';
import AudioPlayer from './AudioPlayer';
import { Button } from './ui/button';

interface TranslationCardProps {
  asset: WithSource<AssetWithVoteCount>;
  previewText: string;
  audioSegments: string[] | undefined;
  handleTranslationPress: (id: string) => void;
  onTranscribe?: (uri: string) => void;
  isTranscribing?: boolean;
  isHighlighted?: boolean;
}

export const TranslationCard = ({
  asset,
  audioSegments = [],
  handleTranslationPress,
  previewText,
  onTranscribe,
  isTranscribing = false,
  isHighlighted = false
}: TranslationCardProps) => {
  const { t } = useLocalization();
  const currentLayer = useStatusContext();
  const { allowEditing, invisible } = currentLayer.getStatusParams(
    LayerType.ASSET,
    asset.id || '',
    asset as LayerStatus
  );

  const hasAudio =
    asset.audio && asset.audio.length > 0 && audioSegments.length > 0;
  const showText = Boolean(previewText || !hasAudio);
  const isAudioOnlyCard = hasAudio && !showText;
  const showBadgeAbove = isHighlighted && !isAudioOnlyCard;
  const showBadgeWithVotes = isHighlighted && isAudioOnlyCard;

  const handleCardPress = () => {
    if (asset.id) {
      handleTranslationPress(asset.id);
    }
  };

  return (
    <Button
      variant="plain"
      size="auto"
      onPress={handleCardPress}
      className="w-full flex-col items-stretch"
    >
      <Card
        className={cn(
          'transition-opacity',
          !allowEditing && 'opacity-50',
          invisible && 'opacity-20'
        )}
      >
        <CardHeader className="flex-col gap-3">
          <View className="flex-col gap-2">
            {showBadgeAbove && (
              <View className="w-full flex-row justify-start">
                <NewHighlightBadge />
              </View>
            )}

            <View
              className={cn(
                'w-full flex-row gap-3',
                isAudioOnlyCard
                  ? cn(
                      'items-center',
                      showBadgeWithVotes ? 'justify-between' : 'justify-end'
                    )
                  : 'items-start'
              )}
            >
              {showBadgeWithVotes && <NewHighlightBadge />}

              {showText && (
                <Text
                  numberOfLines={2}
                  className="min-w-0 flex-1 text-base leading-relaxed text-foreground"
                >
                  {previewText || t('noText')}
                </Text>
              )}

              <View className="shrink-0 flex-col items-end gap-1">
                <View className="flex-row items-center gap-2">
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
                      asset.net_votes > 0 &&
                        'text-green-700 dark:text-green-400',
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
                {SHOW_DEV_ELEMENTS && (
                  <Text className="text-xs text-muted-foreground/70">
                    {asset.up_votes}↑ {asset.down_votes}↓
                  </Text>
                )}
              </View>
            </View>

            {hasAudio && (
              <View className="w-full rounded-md border border-border bg-muted/30 p-3">
                <AudioPlayer
                  audioSegments={audioSegments}
                  useCarousel={false}
                  mini={true}
                  onTranscribe={onTranscribe}
                  isTranscribing={isTranscribing}
                />
              </View>
            )}
          </View>

          {SHOW_DEV_ELEMENTS && (
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
        </CardHeader>
      </Card>
    </Button>
  );
};
