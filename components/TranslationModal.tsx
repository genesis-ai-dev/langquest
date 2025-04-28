import { useAuth } from '@/contexts/AuthContext';
import {
  Translation,
  translationService
} from '@/database_services/translationService';
import { Vote, voteService } from '@/database_services/voteService';
import { vote } from '@/db/drizzleSchema';
import { useSystem } from '@/contexts/SystemContext';
import { useTranslation } from '@/hooks/useTranslation';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import AudioPlayer from './AudioPlayer';
import { VoteCommentModal } from './VoteCommentModal';
import { getLocalUriFromAssetId } from '@/utils/attachmentUtils';
import { ReportTranslationModal } from './ReportTranslationModal';

interface TranslationModalProps {
  translation: Translation;
  onClose: () => void;
  onVoteSubmitted: () => void;
}

export const TranslationModal: React.FC<TranslationModalProps> = ({
  translation: initialTranslation,
  onClose,
  onVoteSubmitted
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [translation, setTranslation] = useState(initialTranslation);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentVoteType, setCurrentVoteType] = useState<'up' | 'down'>('up');
  const [userVote, setUserVote] = useState<typeof vote.$inferSelect>();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const system = useSystem();

  useEffect(() => {
    const loadAudioUri = async () => {
      if (translation.audio) {
        setLoadingAudio(true);
        try {
          const uri = await getLocalUriFromAssetId(translation.audio);
          setAudioUri(uri);
        } catch (error) {
          console.error('Error loading audio URI:', error);
        } finally {
          setLoadingAudio(false);
        }
      } else {
        setAudioUri(null);
      }
    };

    loadAudioUri();
  }, [translation.audio]);

  useEffect(() => {
    const loadVotes = async () => {
      const translationVotes = await voteService.getVotesByTranslationId(
        translation.id
      );
      setVotes(translationVotes);
      if (currentUser) {
        const userVote = translationVotes.find(
          (v) => v.creator_id === currentUser.id
        );
        setUserVote(userVote);
      }
    };
    loadVotes();
  }, [translation.id, currentUser]);

  useEffect(() => {
    setTranslation(initialTranslation);
  }, [initialTranslation]);

  const loadUserVote = async () => {
    try {
      const vote = await voteService.getUserVoteForTranslation(
        translation.id,
        currentUser!.id
      );
      setUserVote(vote);
    } catch (error) {
      console.error('Error loading user vote:', error);
    }
  };

  const calculateVoteCount = () => {
    return votes.reduce(
      (acc, vote) => acc + (vote.polarity === 'up' ? 1 : -1),
      0
    );
  };

  const isOwnTranslation = currentUser?.id === translation.creator_id;

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!currentUser || isOwnTranslation) {
      Alert.alert('Error', t('logInToVote'));
      return;
    }

    try {
      await voteService.addVote({
        translation_id: translation.id,
        creator_id: currentUser.id,
        polarity: voteType
      });
      onVoteSubmitted();
      // Update local state to reflect the vote
      const updatedVotes = await voteService.getVotesByTranslationId(
        translation.id
      );
      setVotes(updatedVotes);
      const newUserVote = updatedVotes.find(
        (v) => v.creator_id === currentUser.id
      );
      setUserVote(newUserVote);
    } catch (error) {
      console.error('Error handling vote:', error);
      Alert.alert('Error', 'Failed to submit vote');
    }
  };

  const handleVoteSubmit = async (comment: string) => {
    try {
      await voteService.addVote({
        translation_id: translation.id,
        creator_id: currentUser!.id,
        polarity: currentVoteType,
        comment: comment || undefined
      });

      // Get updated translation data after vote
      const updatedTranslations =
        await translationService.getTranslationsByAssetId(translation.asset_id);
      const updatedTranslation = updatedTranslations.find(
        (t) => t.id === translation.id
      );
      if (updatedTranslation) {
        setTranslation(updatedTranslation);
      }

      onVoteSubmitted();
      await loadUserVote();
      setShowVoteModal(false);
    } catch (error) {
      console.error('Error submitting vote:', error);
      Alert.alert('Error', t('failedToVote'));
    }
  };

  const handleReportPress = () => {
    if (!currentUser) {
      Alert.alert('Error', t('logInToReport'));
      return;
    }

    if (isOwnTranslation) {
      Alert.alert('Error', 'You cannot report your own translation');
      return;
    }

    setShowReportModal(true);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} />
      <View style={styles.modal}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>

        {translation.text && (
          <ScrollView style={styles.scrollView}>
            {/* <Text style={styles.translatorInfo}>
              Translated by {translation.creator.username} in{' '}
              {translation.target_language.native_name || translation.target_language.english_name}
            </Text> */}
            <Text style={styles.text}>{translation.text}</Text>
          </ScrollView>
        )}

        <View style={styles.audioPlayerContainer}>
          {loadingAudio ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            translation.audio &&
            audioUri && (
              <AudioPlayer
                audioUri={audioUri}
                useCarousel={false}
                mini={true}
              />
            )
          )}
        </View>

        <View style={styles.actionsContainer}>
          <View style={styles.feedbackContainer}>
            <TouchableOpacity
              style={[
                styles.feedbackButton,
                isOwnTranslation && styles.feedbackButtonDisabled
              ]}
              onPress={() => handleVote('up')}
              disabled={isOwnTranslation}
            >
              <Ionicons
                name={
                  userVote?.polarity === 'up'
                    ? 'thumbs-up'
                    : 'thumbs-up-outline'
                }
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <Text style={styles.voteRank}>{calculateVoteCount()}</Text>
            <TouchableOpacity
              style={[
                styles.feedbackButton,
                isOwnTranslation && styles.feedbackButtonDisabled
              ]}
              onPress={() => handleVote('down')}
              disabled={isOwnTranslation}
            >
              <Ionicons
                name={
                  userVote?.polarity === 'down'
                    ? 'thumbs-down'
                    : 'thumbs-down-outline'
                }
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.reportButton,
              isOwnTranslation && styles.feedbackButtonDisabled
            ]}
            onPress={handleReportPress}
            disabled={isOwnTranslation}
          >
            <Ionicons name="flag-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <VoteCommentModal
        isVisible={showVoteModal}
        onClose={() => setShowVoteModal(false)}
        onSubmit={handleVoteSubmit}
        voteType={currentVoteType}
      />

      {showReportModal && (
        <ReportTranslationModal
          isVisible={showReportModal}
          onClose={() => setShowReportModal(false)}
          translation={translation}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  modal: {
    width: '80%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.medium,
    maxHeight: '80%'
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: spacing.xsmall
  },
  scrollView: {
    marginVertical: spacing.medium,
    maxHeight: 200
  },
  text: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginBottom: spacing.medium
  },
  translatorInfo: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.small
  },
  audioPlayerContainer: {
    marginBottom: spacing.medium
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  feedbackButton: {
    padding: spacing.xsmall
  },
  feedbackButtonDisabled: {
    opacity: 0.5
  },
  voteRank: {
    marginHorizontal: spacing.small,
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: 'bold'
  },
  reportButton: {
    padding: spacing.xsmall,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.inputBorder
  }
});
