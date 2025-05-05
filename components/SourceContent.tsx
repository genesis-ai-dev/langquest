import type { asset_content_link, language } from '@/db/drizzleSchema';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import MiniAudioPlayer from './MiniAudioPlayer';

interface SourceContentProps {
  content: typeof asset_content_link.$inferSelect;
  sourceLanguage: typeof language.$inferSelect | null;
  audioUri?: string | null;
  isLoading?: boolean;
}

export const SourceContent: React.FC<SourceContentProps> = ({
  content,
  sourceLanguage,
  audioUri,
  isLoading = false
}) => {
  console.log('content124', { content, sourceLanguage, audioUri, isLoading });
  return (
    <View style={styles.container}>
      <ScrollView>
        <Text style={styles.languageLabel}>
          {sourceLanguage?.native_name ?? sourceLanguage?.english_name}:
        </Text>
        <Text style={styles.text}>{content.text}</Text>
      </ScrollView>
      {content.audio_id && audioUri ? (
        <MiniAudioPlayer
          audioFile={{
            id: content.id,
            title: content.text,
            uri: audioUri
          }}
        />
      ) : content.audio_id && isLoading ? (
        <View style={styles.audioLoading}>
          <Text style={{ color: colors.textSecondary }}>Loading audio...</Text>
          <ActivityIndicator size="small" />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.medium,
    paddingTop: spacing.medium,
    paddingBottom: spacing.large,
    marginHorizontal: spacing.small,
    maxHeight: 200
    // width: '100%',
    // flex: 1,
    // justifyContent: 'space-between'
  },
  languageLabel: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: 'bold',
    marginBottom: spacing.small
  },
  text: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginBottom: spacing.medium
  },
  audioLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
