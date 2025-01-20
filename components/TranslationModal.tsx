import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView
} from 'react-native';
import { colors, fontSizes, spacing, borderRadius } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import AudioPlayer from './AudioPlayer';
import { VoteCommentModal } from './VoteCommentModal';
import { Translation } from '@/database_services/translationService';
import { voteService, Vote } from '@/database_services/voteService';
import { translationService } from '@/database_services/translationService';
import { vote, language } from '@/db/drizzleSchema';
import { Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';

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
  const [currentVoteType, setCurrentVoteType] = useState<'up' | 'down'>('up');
  const [userVote, setUserVote] = useState<typeof vote.$inferSelect | null>(
    null
  );
  const [votes, setVotes] = useState<Vote[]>([]);

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
        setUserVote(userVote || null);
      }
    };
    loadVotes();
  }, [translation.id, currentUser]);

  useEffect(() => {
    setTranslation(initialTranslation);
  }, [initialTranslation]);

  const loadVotes = async () => {
    try {
      const translationVotes = await voteService.getVotesByTranslationId(
        translation.id
      );
      setVotes(translationVotes);
    } catch (error) {
      console.error('Error loading votes:', error);
    }
  };

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
      setUserVote(newUserVote || null);
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

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} />
      <View style={styles.modal}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>

        <ScrollView style={styles.scrollView}>
          {/* <Text style={styles.translatorInfo}>
            Translated by {translation.creator.username} in{' '}
            {translation.target_language.native_name || translation.target_language.english_name}
          </Text> */}
          <Text style={styles.text}>{translation.text}</Text>
        </ScrollView>

        <View style={styles.audioPlayerContainer}>
          {translation.audio && (
            <AudioPlayer
              audioUri={translation.audio}
              useCarousel={false}
              mini={true}
            />
          )}
        </View>

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
                userVote?.polarity === 'up' ? 'thumbs-up' : 'thumbs-up-outline'
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
      </View>

      <VoteCommentModal
        isVisible={showVoteModal}
        onClose={() => setShowVoteModal(false)}
        onSubmit={handleVoteSubmit}
        voteType={currentVoteType}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'center',
    alignItems: 'center'
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    width: '90%',
    maxHeight: '80%',
    paddingTop: spacing.xlarge,
    paddingBottom: spacing.small
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  closeButton: {
    position: 'absolute',
    top: spacing.small,
    right: spacing.small,
    padding: spacing.small
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium
  },
  scrollView: {
    maxHeight: '70%'
  },
  audioPlayerContainer: {
    marginTop: spacing.medium // Add space above the audio player
  },
  feedbackContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.medium,
    paddingHorizontal: spacing.large
  },
  voteRank: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: 'bold'
  },
  feedbackButton: {
    padding: spacing.medium,
    marginHorizontal: spacing.large
  },
  feedbackButtonDisabled: {
    opacity: 0.5
  },
  text: {
    fontSize: fontSizes.medium,
    color: colors.text
  }
});
