import AudioPlayer from '@/components/AudioPlayer';
import { useAuth } from '@/contexts/AuthContext';
import { voteService } from '@/database_services/voteService';
import { translation, vote } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface NextGenTranslationModalProps {
  visible: boolean;
  onClose: () => void;
  translationId: string;
  onVoteSuccess?: () => void;
}

interface TranslationWithVotes {
  id: string;
  text: string | null;
  audio: string | null;
  creator_id: string;
  created_at: string;
  target_language_id: string;
  asset_id: string;
  votes: {
    id: string;
    polarity: 'up' | 'down';
    creator_id: string;
    active: boolean;
  }[];
}

function useNextGenTranslation(translationId: string) {
  return useQuery({
    queryKey: ['translation', 'nextgen', translationId],
    queryFn: async () => {
      // Get translation
      const translationResult = await system.db
        .select()
        .from(translation)
        .where(eq(translation.id, translationId))
        .limit(1);

      if (!translationResult.length) return null;

      const translationData = translationResult[0];

      // Get votes
      const votesResult = await system.db
        .select()
        .from(vote)
        .where(eq(vote.translation_id, translationId));

      return {
        ...translationData,
        votes: votesResult
      } as TranslationWithVotes;
    },
    enabled: !!translationId
  });
}

export default function NextGenTranslationModal({
  visible,
  onClose,
  translationId,
  onVoteSuccess
}: NextGenTranslationModalProps) {
  const { currentUser } = useAuth();
  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();
  const [pendingVoteType, setPendingVoteType] = useState<'up' | 'down' | null>(
    null
  );

  const { data: translationData, isLoading } =
    useNextGenTranslation(translationId);

  // Get audio attachment states
  const audioIds = translationData?.audio ? [translationData.audio] : [];
  const { attachmentStates } = useAttachmentStates(audioIds);

  // Calculate vote counts
  const upVotes =
    translationData?.votes.filter((v) => v.active && v.polarity === 'up')
      .length ?? 0;
  const downVotes =
    translationData?.votes.filter((v) => v.active && v.polarity === 'down')
      .length ?? 0;
  const userVote = translationData?.votes.find(
    (v) => v.creator_id === currentUser?.id
  );

  const { mutateAsync: handleVote, isPending: isVotePending } = useMutation({
    mutationFn: async ({ voteType }: { voteType: 'up' | 'down' }) => {
      if (!currentUser || !translationData) {
        Alert.alert('Error', 'Please log in to vote');
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
        queryKey: ['translation', 'nextgen', translationId]
      });
    },
    onSuccess: () => {
      // Call the parent callback to refresh data
      onVoteSuccess?.();
    },
    onSettled: () => {
      setPendingVoteType(null);
    }
  });

  const getAudioUri = () => {
    if (!translationData?.audio) return undefined;
    const localUri = attachmentStates.get(translationData.audio)?.local_uri;
    return localUri
      ? system.permAttachmentQueue?.getLocalUri(localUri)
      : undefined;
  };

  const isOwnTranslation = currentUser?.id === translationData?.creator_id;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayTouchable} onPress={onClose} />
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Translation</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <ActivityIndicator
                size="large"
                color={colors.primary}
                style={styles.loader}
              />
            ) : translationData ? (
              <>
                {/* Translation Text */}
                <View style={styles.translationContainer}>
                  <Text style={styles.translationText}>
                    {translationData.text || '(No text)'}
                  </Text>
                </View>

                {/* Audio Player */}
                {translationData.audio && getAudioUri() && (
                  <View style={styles.audioContainer}>
                    <AudioPlayer
                      audioUri={getAudioUri()}
                      useCarousel={false}
                      mini={false}
                    />
                  </View>
                )}

                {/* Vote Counts Display */}
                <View style={styles.voteCountsContainer}>
                  <View style={styles.voteCountItem}>
                    <Ionicons
                      name="thumbs-up"
                      size={20}
                      color={colors.success}
                    />
                    <Text style={styles.voteCountText}>{upVotes}</Text>
                  </View>
                  <View style={styles.voteCountItem}>
                    <Ionicons
                      name="thumbs-down"
                      size={20}
                      color={colors.error}
                    />
                    <Text style={styles.voteCountText}>{downVotes}</Text>
                  </View>
                  <Text style={styles.netVoteText}>
                    Net: {upVotes - downVotes > 0 ? '+' : ''}
                    {upVotes - downVotes}
                  </Text>
                </View>

                {/* Voting Buttons */}
                {!isOwnTranslation && currentUser && (
                  <View style={styles.votingContainer}>
                    <TouchableOpacity
                      style={[
                        styles.voteButton,
                        styles.upVoteButton,
                        userVote?.polarity === 'up' && styles.voteButtonActive
                      ]}
                      onPress={() => handleVote({ voteType: 'up' })}
                      disabled={isVotePending}
                    >
                      {pendingVoteType === 'up' ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.buttonText}
                        />
                      ) : (
                        <>
                          <Ionicons
                            name={
                              userVote?.polarity === 'up'
                                ? 'thumbs-up'
                                : 'thumbs-up-outline'
                            }
                            size={24}
                            color={colors.buttonText}
                          />
                          <Text style={styles.voteButtonText}>Good</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.voteButton,
                        styles.downVoteButton,
                        userVote?.polarity === 'down' && styles.voteButtonActive
                      ]}
                      onPress={() => handleVote({ voteType: 'down' })}
                      disabled={isVotePending}
                    >
                      {pendingVoteType === 'down' ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.buttonText}
                        />
                      ) : (
                        <>
                          <Ionicons
                            name={
                              userVote?.polarity === 'down'
                                ? 'thumbs-down'
                                : 'thumbs-down-outline'
                            }
                            size={24}
                            color={colors.buttonText}
                          />
                          <Text style={styles.voteButtonText}>Needs Work</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Debug Info */}
                <View style={styles.debugContainer}>
                  <Text style={styles.debugText}>
                    {isOnline ? '🟢 Online' : '🔴 Offline'} • ID:{' '}
                    {translationData.id.substring(0, 8)}...
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.errorText}>Translation not found</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    width: '90%',
    maxHeight: '80%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  title: {
    fontSize: fontSizes.xlarge,
    fontWeight: 'bold',
    color: colors.text
  },
  closeButton: {
    padding: spacing.small
  },
  scrollView: {
    maxHeight: 400
  },
  loader: {
    marginVertical: spacing.xlarge
  },
  translationContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium
  },
  translationText: {
    fontSize: fontSizes.large,
    color: colors.text,
    lineHeight: fontSizes.large * 1.4
  },
  audioContainer: {
    marginBottom: spacing.medium,
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium
  },
  voteCountsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    gap: spacing.large
  },
  voteCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small
  },
  voteCountText: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    color: colors.text
  },
  netVoteText: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 'auto'
  },
  votingContainer: {
    flexDirection: 'row',
    gap: spacing.medium,
    marginBottom: spacing.medium
  },
  voteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.large,
    borderRadius: borderRadius.medium,
    gap: spacing.small
  },
  upVoteButton: {
    backgroundColor: colors.success
  },
  downVoteButton: {
    backgroundColor: colors.primary
  },
  voteButtonActive: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }]
  },
  voteButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  },
  debugContainer: {
    alignItems: 'center',
    marginTop: spacing.medium
  },
  debugText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  errorText: {
    fontSize: fontSizes.medium,
    color: colors.error,
    textAlign: 'center',
    marginVertical: spacing.xlarge
  }
});
