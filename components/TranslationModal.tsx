import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { translationService } from '@/database_services/translationService';
import { voteService } from '@/database_services/voteService';
import {
  useTranslationById,
  useTranslationProjectInfo
} from '@/hooks/db/useTranslations';
import { useVotesByTranslationId } from '@/hooks/db/useVotes';
import { useLocalization } from '@/hooks/useLocalization';
import { useTranslationReports } from '@/hooks/useTranslationReports';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { getLocalUriFromAssetId } from '@/utils/attachmentUtils';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@powersync/tanstack-react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { PrivateAccessGate } from './PrivateAccessGate';
import { ReportModal } from './ReportModal';
import Shimmer from './Shimmer';

interface TranslationModalProps {
  translationId: string;
  assetId?: string;
  onClose: () => void;
  onVoteSubmitted?: () => void;
  onReportSubmitted?: () => void;
}

export const TranslationModal: React.FC<TranslationModalProps> = ({
  translationId,
  assetId,
  onClose,
  onVoteSubmitted,
  onReportSubmitted
}) => {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const { stopCurrentSound } = useAudio();
  const [showReportModal, setShowReportModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [pendingVoteType, setPendingVoteType] = useState<'up' | 'down' | null>(
    null
  );
  const { hasReported } = useTranslationReports(translationId, currentUser!.id);

  const queryClient = useQueryClient();

  const { translation } = useTranslationById(translationId, assetId);
  const { votes } = useVotesByTranslationId(translationId);

  const userVote = votes?.find((v) => v.creator_id === currentUser?.id);

  const voteCount =
    votes?.reduce((acc, vote) => acc + (vote.polarity === 'up' ? 1 : -1), 0) ??
    0;

  const { data: audioUri, isLoading: loadingAudio } = useQuery({
    queryKey: ['audio', translation?.audio],
    queryFn: async () => {
      if (!translation?.audio) return null;
      try {
        return await getLocalUriFromAssetId(translation.audio);
      } catch (error) {
        console.error('Error loading audio URI:', error);
        return null;
      }
    },
    enabled: !!translation?.audio
  });

  const { projectInfo } = useTranslationProjectInfo(translation?.asset_id);
  const project = projectInfo?.quest.project;

  // Check if user has access to edit translations in this project
  const { hasAccess: canEditTranslation } = useUserPermissions(
    project?.id || '',
    'edit_transcription',
    project?.private
  );

  useEffect(() => {
    setEditedText(translation?.text ?? '');
  }, [translation]);

  const isOwnTranslation = currentUser?.id === translation?.creator_id;
  const { mutateAsync: handleVote, isPending: isVotePending } = useMutation({
    mutationFn: async ({ voteType }: { voteType: 'up' | 'down' }) => {
      if (!currentUser) {
        Alert.alert('Error', t('logInToVote'));
        return;
      }
      setPendingVoteType(voteType);

      // If user already voted with the same polarity, deactivate the vote
      if (userVote?.polarity === voteType) {
        await voteService.addVote({
          translation_id: translationId,
          creator_id: currentUser.id,
          vote_id: userVote.id,
          polarity: voteType,
          active: false
        });
      } else {
        // Otherwise, add/update the vote
        await voteService.addVote({
          translation_id: translationId,
          creator_id: currentUser.id,
          vote_id: userVote?.id,
          polarity: voteType
        });
      }

      await queryClient.invalidateQueries({
        queryKey: ['translation', translationId]
      });
      onVoteSubmitted?.();
    },
    onSettled: () => {
      setPendingVoteType(null);
    }
  });

  const handleReportPress = () => {
    if (!currentUser) {
      Alert.alert('Error', t('logInToReport'));
      return;
    }

    if (isOwnTranslation) {
      Alert.alert('Error', t('cannotReportOwnTranslation'));
      return;
    }

    if (hasReported) {
      Alert.alert('Error', t('alreadyReportedTranslation'));
      return;
    }

    setShowReportModal(true);
  };

  const handleReportSubmitted = () => {
    setShowReportModal(false);
    onReportSubmitted?.();
  };

  const { mutate: editTranslation, isPending: isEditPending } = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        throw new Error(t('logInToTranslate'));
      }

      if (!editedText.trim()) {
        throw new Error(t('fillFields'));
      }

      if (!translation?.target_language_id || !translation.asset_id) {
        throw new Error('Invalid translation data');
      }

      return translationService.createTranslation({
        text: editedText.trim(),
        target_language_id: translation.target_language_id,
        asset_id: translation.asset_id,
        creator_id: currentUser.id,
        audio: translation.audio ?? ''
      });
    },
    onSuccess: () => {
      onVoteSubmitted?.();
      onClose();
    },
    onError: (error) => {
      console.error('Error creating edited translation:', error);
      Alert.alert('Error', t('failedCreateTranslation'));
    }
  });

  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const handleClose = () => {
    void stopCurrentSound();
    onClose();
  };

  if (!translation) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.overlay} onPress={handleClose} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.overlay} onPress={handleClose} />
      <View style={styles.modal}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: spacing.medium
          }}
        >
          <TouchableOpacity
            style={[
              styles.reportButton,
              (isOwnTranslation || hasReported) &&
                styles.feedbackButtonDisabled,
              {
                alignSelf: 'flex-start'
              }
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
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
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
                onPress={canEditTranslation ? toggleEdit : undefined}
                disabled={!canEditTranslation}
              >
                <Ionicons
                  name={canEditTranslation ? 'pencil' : 'lock-closed'}
                  size={18}
                  color={
                    canEditTranslation ? colors.primary : colors.textSecondary
                  }
                />
              </TouchableOpacity>
              <Text style={styles.text}>
                {translation.text || t('enterTranslation')}
              </Text>
            </View>
          )}
        </ScrollView>
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
            style={[
              styles.submitButton,
              (isEditPending || !editedText.trim()) && {
                backgroundColor: colors.disabled
              }
            ]}
            onPress={() => editTranslation()}
            disabled={isEditPending || !editedText.trim()}
          >
            {isEditPending ? (
              <ActivityIndicator size="small" color={colors.buttonText} />
            ) : (
              <Text style={styles.submitButtonText}>{t('submit')}</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.actionsContainer}>
            <View style={styles.feedbackContainer}>
              {!isOwnTranslation && (
                <PrivateAccessGate
                  projectId={project?.id || ''}
                  projectName={project?.name || ''}
                  isPrivate={project?.private || false}
                  action="edit_transcription"
                  inline={true}
                >
                  <View
                    style={{
                      flexDirection: 'row'
                    }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.newTranslationButton,
                        {
                          flex: 1,
                          backgroundColor: '#6545B6',
                          borderWidth: 2,
                          borderColor:
                            userVote?.polarity === 'up'
                              ? colors.alert
                              : '#6545B6'
                        }
                      ]}
                      onPress={() => handleVote({ voteType: 'up' })}
                      disabled={isVotePending}
                    >
                      {pendingVoteType === 'up' && (
                        <View style={styles.shimmerOverlay}>
                          <Shimmer
                            width={200}
                            height={50}
                            backgroundColor="transparent"
                            highlightColor="rgba(255, 255, 255, 0.3)"
                          />
                        </View>
                      )}
                      <Ionicons
                        name={
                          userVote?.polarity === 'up'
                            ? 'thumbs-up'
                            : 'thumbs-up-outline'
                        }
                        size={24}
                        color={colors.buttonText}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.newTranslationButton,
                        {
                          flex: 1,
                          borderWidth: 2,
                          backgroundColor: colors.primary,
                          borderColor:
                            userVote?.polarity === 'down'
                              ? colors.alert
                              : colors.primary
                        }
                      ]}
                      onPress={() => handleVote({ voteType: 'down' })}
                      disabled={isVotePending}
                    >
                      {pendingVoteType === 'down' && (
                        <View style={styles.shimmerOverlay}>
                          <Shimmer
                            width={200}
                            height={50}
                            backgroundColor="transparent"
                            highlightColor="rgba(255, 255, 255, 0.3)"
                          />
                        </View>
                      )}
                      <Ionicons
                        name={
                          userVote?.polarity === 'down'
                            ? 'thumbs-down'
                            : 'thumbs-down-outline'
                        }
                        size={24}
                        color={colors.buttonText}
                      />
                    </TouchableOpacity>
                  </View>
                </PrivateAccessGate>
              )}
              {isOwnTranslation && (
                <View style={styles.feedbackContainer}>
                  <Text style={styles.voteRank}>{voteCount}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {showReportModal && (
        <ReportModal
          isVisible={showReportModal}
          onClose={() => setShowReportModal(false)}
          recordId={translationId}
          recordTable="translations"
          creatorId={translation.creator_id}
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
    alignItems: 'center',
    flex: 1
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
  },
  newTranslationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.medium,
    height: 50,
    position: 'relative',
    overflow: 'hidden'
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  }
});
