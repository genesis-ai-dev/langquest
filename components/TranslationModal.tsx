import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/contexts/SystemContext';
import {
  Translation,
  translationService
} from '@/database_services/translationService';
import { Vote, voteService } from '@/database_services/voteService';
import { vote } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { getLocalUriFromAssetId } from '@/utils/attachmentUtils';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import AudioPlayer from './AudioPlayer';
import { VoteCommentModal } from './VoteCommentModal';

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
  const [userVote, setUserVote] = useState<typeof vote.$inferSelect>();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    setEditedText(initialTranslation.text || '');
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

  const handleEditSubmit = async () => {
    if (!currentUser) {
      Alert.alert('Error', t('logInToTranslate'));
      return;
    }

    if (!editedText.trim()) {
      Alert.alert('Error', t('fillFields'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Create a new translation linked to the same audio file
      await translationService.createTranslation({
        text: editedText.trim(),
        target_language_id: translation.target_language_id,
        asset_id: translation.asset_id,
        creator_id: currentUser.id,
        audio: translation.audio || ''
      });

      onVoteSubmitted();
      onClose();
    } catch (error) {
      console.error('Error creating edited translation:', error);
      Alert.alert('Error', t('failedCreateTranslation'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} />
      <View style={styles.modal}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>

        {translation.text || isEditing ? (
          <ScrollView style={styles.scrollView}>
            {isEditing ? (
              <TextInput
                style={styles.textInput}
                multiline
                placeholder={t('enterTranslation')}
                placeholderTextColor={colors.textSecondary}
                value={editedText}
                onChangeText={setEditedText}
              />
            ) : (
              <View style={styles.textContainer}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={toggleEdit}
                >
                  <Ionicons name="pencil" size={18} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.text}>{translation.text}</Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView style={styles.scrollView}>
            <View style={styles.textContainer}>
              <TouchableOpacity style={styles.editButton} onPress={toggleEdit}>
                <Ionicons name="pencil" size={18} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.placeholderText}>
                {t('enterTranslation')}
              </Text>
            </View>
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

        {isEditing ? (
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleEditSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.buttonText} />
            ) : (
              <Text style={styles.submitButtonText}>{t('submit')}</Text>
            )}
          </TouchableOpacity>
        ) : (
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
        )}
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
  textContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start'
  },
  text: {
    fontSize: fontSizes.medium,
    color: colors.text,
    flex: 1
  },
  placeholderText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    fontStyle: 'italic',
    flex: 1
  },
  editButton: {
    padding: spacing.xsmall,
    marginRight: spacing.small
  },
  textInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    color: colors.text,
    fontSize: fontSizes.medium,
    minHeight: 100
  },
  audioPlayerContainer: {
    marginTop: spacing.medium
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
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    alignItems: 'center',
    marginTop: spacing.medium
  },
  submitButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  }
});
