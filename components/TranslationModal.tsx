import { useAuth } from '@/contexts/AuthContext';
import type { Translation } from '@/database_services/translationService';
import { translationService } from '@/database_services/translationService';
import type { Vote } from '@/database_services/voteService';
import { voteService } from '@/database_services/voteService';
import type { vote } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import { useTranslationReports } from '@/hooks/useTranslationReports';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { getLocalUriFromAssetId } from '@/utils/attachmentUtils';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
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
import { ReportModal } from './ReportModal';
import { VoteCommentModal } from './VoteCommentModal';

interface TranslationModalProps {
  translation: Translation;
  onClose: () => void;
  onVoteSubmitted: () => void;
  onReportSubmitted: () => void;
}

export const TranslationModal: React.FC<TranslationModalProps> = ({
  translation: initialTranslation,
  onClose,
  onVoteSubmitted,
  onReportSubmitted
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentVoteType] = useState<'up' | 'down'>('up');
  const [userVote, setUserVote] = useState<typeof vote.$inferSelect>();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { hasReported } = useTranslationReports(
    initialTranslation.id,
    currentUser!.id
  );

  // Use TanStack Query to load audio URI
  const { data: audioUri, isLoading: loadingAudio } = useQuery({
    queryKey: ['audio', initialTranslation.audio],
    queryFn: async () => {
      if (!initialTranslation.audio) return null;
      try {
        return await getLocalUriFromAssetId(initialTranslation.audio);
      } catch (error) {
        console.error('Error loading audio URI:', error);
        return null;
      }
    },
    enabled: !!initialTranslation.audio
  });

  useEffect(() => {
    const loadVotes = async () => {
      const translationVotes = await voteService.getVotesByTranslationId(
        initialTranslation.id
      );
      setVotes(translationVotes);
      if (currentUser) {
        const userVote = translationVotes.find(
          (v) => v.creator_id === currentUser.id
        );
        setUserVote(userVote);
      }
    };
    void loadVotes();
  }, [initialTranslation.id, currentUser]);

  useEffect(() => {
    setEditedText(initialTranslation.text ?? '');
  }, [initialTranslation]);

  const loadUserVote = async () => {
    try {
      const vote = await voteService.getUserVoteForTranslation(
        initialTranslation.id,
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

  const isOwnTranslation = currentUser?.id === initialTranslation.creator_id;

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!currentUser || isOwnTranslation) {
      Alert.alert('Error', t('logInToVote'));
      return;
    }

    try {
      await voteService.addVote({
        translation_id: initialTranslation.id,
        creator_id: currentUser.id,
        polarity: voteType
      });
      onVoteSubmitted();
      const updatedVotes = await voteService.getVotesByTranslationId(
        initialTranslation.id
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
        translation_id: initialTranslation.id,
        creator_id: currentUser!.id,
        polarity: currentVoteType,
        comment: comment || undefined
      });

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

    if (hasReported) {
      Alert.alert('Error', 'You have already reported this translation');
      return;
    }

    setShowReportModal(true);
  };

  const handleReportSubmitted = () => {
    setShowReportModal(false);
    onReportSubmitted();
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
        target_language_id: initialTranslation.target_language_id,
        asset_id: initialTranslation.asset_id,
        creator_id: currentUser.id,
        audio: initialTranslation.audio ?? ''
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

        {(initialTranslation.text ?? isEditing) ? (
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
                <Text style={styles.text}>{initialTranslation.text}</Text>
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
            initialTranslation.audio &&
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
                (isOwnTranslation || hasReported) &&
                  styles.feedbackButtonDisabled
              ]}
              onPress={handleReportPress}
              disabled={isOwnTranslation || hasReported}
            >
              <Ionicons
                name={hasReported ? 'flag' : 'flag-outline'}
                size={20}
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

      {showReportModal && (
        <ReportModal
          isVisible={showReportModal}
          onClose={() => setShowReportModal(false)}
          recordId={initialTranslation.id}
          recordTable="translations"
          creatorId={initialTranslation.creator_id}
          onReportSubmitted={handleReportSubmitted}
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
  translatorInfo: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.small
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
    marginTop: spacing.medium,
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
