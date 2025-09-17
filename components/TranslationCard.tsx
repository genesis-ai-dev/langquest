import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { LayerStatus } from '@/database_services/types';
import type { translation } from '@/db/drizzleSchema';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { Ionicons } from '@expo/vector-icons';
import type { InferSelectModel } from 'drizzle-orm';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AudioPlayer from './AudioPlayer';

type Translation = InferSelectModel<typeof translation>;

export interface TranslationWithVotes extends Translation {
  upVotes: number;
  downVotes: number;
  netVotes: number;
  source?: HybridDataSource;
}

interface TranslationCardProps {
  translation: TranslationWithVotes;
  previewText: string;
  audioUri: string | undefined;
  handleTranslationPress: (id: string) => void;
}

export const TranslationCard = ({
  translation,
  audioUri = undefined,
  handleTranslationPress
}: TranslationCardProps) => {
  const getPreviewText = (fullText: string, maxLength = 50) => {
    if (!fullText) return '(Empty translation)';
    if (fullText.length <= maxLength) return fullText;
    return fullText.substring(0, maxLength).trim() + '...';
  };

  const currentLayer = useStatusContext();
  const { allowEditing, invisible } = currentLayer.getStatusParams(
    LayerType.ASSET,
    translation.id || '',
    translation as LayerStatus
  );

  return (
    <TouchableOpacity
      key={translation.id}
      style={[
        styles.translationCard,
        !allowEditing && sharedStyles.disabled,
        invisible && sharedStyles.invisible
      ]}
      onPress={() => handleTranslationPress(translation.id)}
    >
      <View style={styles.translationCardContent}>
        <View style={styles.translationCardLeft}>
          <View style={styles.translationHeader}>
            <Text style={styles.translationPreview} numberOfLines={2}>
              {getPreviewText(translation.text || '')}
            </Text>
            {translation.audio && (
              <Ionicons
                name="volume-high"
                size={16}
                color={colors.primary}
                style={styles.audioIcon}
              />
            )}
          </View>

          {/* Audio Player */}
          {translation.audio && audioUri && (
            <View style={styles.audioPlayerContainer}>
              <AudioPlayer
                audioUri={audioUri}
                useCarousel={false}
                mini={true}
              />
            </View>
          )}

          {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
          {SHOW_DEV_ELEMENTS && (
            <Text style={styles.sourceTag}>
              {translation.source === 'cloudSupabase'
                ? '🌐 Cloud'
                : '💾 Offline'}{' '}
              - V: {translation.visible ? '🟢' : '🔴'} | A:{' '}
              {translation.active ? '🟢' : '🔴'}
            </Text>
          )}
        </View>

        <View style={styles.translationCardRight}>
          <View style={styles.voteContainer}>
            <Ionicons
              name="thumbs-up"
              size={16}
              color={colors.text}
              style={{ opacity: translation.upVotes > 0 ? 1 : 0.3 }}
            />
            <Text style={styles.voteCount}>{translation.netVotes}</Text>
            <Ionicons
              name="thumbs-down"
              size={16}
              color={colors.text}
              style={{ opacity: translation.downVotes > 0 ? 1 : 0.3 }}
            />
          </View>
          {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
          {SHOW_DEV_ELEMENTS && (
            <Text style={styles.netVoteText}>
              {translation.upVotes} ↑ {translation.downVotes} ↓
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  translationCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    position: 'relative'
  },
  translationCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  translationCardLeft: {
    flex: 1,
    marginRight: spacing.small
  },
  translationCardRight: {
    alignItems: 'flex-end'
  },
  translationPreview: {
    color: colors.text,
    fontSize: fontSizes.medium,
    marginBottom: spacing.xsmall
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small
  },
  voteCount: {
    color: colors.text,
    fontSize: fontSizes.small,
    fontWeight: 'bold'
  },
  sourceTag: {
    fontSize: fontSizes.xsmall,
    color: colors.textSecondary
  },
  netVoteText: {
    fontSize: fontSizes.xsmall,
    color: colors.textSecondary,
    marginTop: spacing.xsmall
  },
  translationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xsmall
  },
  audioIcon: {
    marginLeft: spacing.small,
    marginTop: 2
  },
  audioPlayerContainer: {
    marginVertical: spacing.small,
    backgroundColor: colors.background,
    borderRadius: borderRadius.small,
    padding: spacing.small
  }
});
