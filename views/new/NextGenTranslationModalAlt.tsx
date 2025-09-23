import AudioPlayer from '@/components/AudioPlayer';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { TranslationSettingsModal } from '@/components/TranslationSettingsModal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import { translationService } from '@/database_services/translationService';
import type { LayerStatus } from '@/database_services/types';
import { voteService } from '@/database_services/voteService';
import { translation, vote } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useHasUserReported } from '@/hooks/useReports';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import {
  FlagIcon,
  LockIcon,
  PencilIcon,
  SettingsIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  UserCircleIcon,
  XIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  View
} from 'react-native';

interface NextGenTranslationModalProps {
  visible: boolean;
  onClose: () => void;
  translationId: string;
  onVoteSuccess?: () => void;
  canVote?: boolean;
  isPrivateProject?: boolean;
  projectId?: string;
  projectName?: string;
}

interface TranslationWithVotes {
  id: string;
  text: string | null;
  audio: string | null;
  creator_id: string;
  created_at: string;
  target_language_id: string;
  asset_id: string;
  active: boolean;
  visible: boolean;
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
  onVoteSuccess,
  canVote: _canVote = true,
  isPrivateProject = false,
  projectId,
  projectName
}: NextGenTranslationModalProps) {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();
  const [pendingVoteType, setPendingVoteType] = useState<'up' | 'down' | null>(
    null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

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
        Alert.alert(t('error'), t('pleaseLogInToVote'));
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

  const {
    hasReported,
    isLoading: isReportLoading,
    refetch
  } = useHasUserReported(translationData?.id || '', 'translations');

  // Initialize edited text when translation data loads
  React.useEffect(() => {
    if (translationData?.text) {
      setEditedText(translationData.text);
    }
  }, [translationData?.text]);

  const { mutate: createTranscription, isPending: isTranscribing } =
    useMutation({
      mutationFn: async () => {
        if (!currentUser || !translationData) {
          throw new Error('Missing required data');
        }

        if (!editedText.trim()) {
          throw new Error('Please enter a transcription');
        }

        // Create a new translation with the same audio but new text
        return translationService.createTranslation({
          text: editedText.trim(),
          target_language_id: translationData.target_language_id,
          asset_id: translationData.asset_id,
          creator_id: currentUser.id,
          audio: translationData.audio || ''
        });
      },
      onSuccess: () => {
        Alert.alert(t('success'), t('yourTranscriptionHasBeenSubmitted'));
        setIsEditing(false);
        onVoteSuccess?.(); // Refresh the list
        onClose();
      },
      onError: (error) => {
        console.error('Error creating transcription:', error);
        Alert.alert(t('error'), t('failedToCreateTranscription'));
      }
    });

  const toggleEdit = () => {
    if (isEditing) {
      // Cancel editing
      setIsEditing(false);
      setEditedText(translationData?.text || '');
    } else {
      // Start editing
      setIsEditing(true);
    }
  };

  const handleSubmitTranscription = () => {
    createTranscription();
  };

  const layerStatus = useStatusContext();
  const { allowEditing, allowSettings } = layerStatus.getStatusParams(
    LayerType.TRANSLATION,
    translationData?.id || '',
    translationData as LayerStatus
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/50">
        <Button
          variant="ghost"
          className="absolute bottom-0 left-0 right-0 top-0"
          onPress={onClose}
        />
        <View className="max-h-[80%] w-[90%] rounded-lg bg-background p-6">
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-foreground">
              {t('translation')}
            </Text>
            <View className="flex-row gap-2">
              {/* Edit/Transcription button */}
              {allowEditing && (
                <PrivateAccessGate
                  projectId={projectId || ''}
                  projectName={projectName || ''}
                  isPrivate={isPrivateProject}
                  action="edit_transcription"
                  renderTrigger={({ onPress, hasAccess }) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={hasAccess ? toggleEdit : onPress}
                      className="p-2"
                    >
                      <Icon
                        as={
                          hasAccess
                            ? isEditing
                              ? XIcon
                              : PencilIcon
                            : LockIcon
                        }
                        size={20}
                        className={
                          hasAccess ? 'text-primary' : 'text-muted-foreground'
                        }
                      />
                    </Button>
                  )}
                />
              )}
              {isOwnTranslation && allowSettings && (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => setShowSettingsModal(true)}
                  className="p-2"
                >
                  <Icon as={SettingsIcon} className="text-foreground" />
                </Button>
              )}
              {!isOwnTranslation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => setShowReportModal(true)}
                  disabled={hasReported || isReportLoading}
                  className="p-2"
                >
                  <Icon
                    as={FlagIcon}
                    className={
                      hasReported ? 'text-muted-foreground' : 'text-foreground'
                    }
                  />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onPress={onClose}
                className="p-1.5"
              >
                <Icon as={XIcon} size={24} className="text-foreground" />
              </Button>
            </View>
          </View>

          <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <ActivityIndicator
                size="large"
                color="#007AFF"
                className="my-8"
              />
            ) : translationData ? (
              <>
                {/* Translation Text */}
                <View className="mb-4 rounded-md bg-muted p-4">
                  {isEditing ? (
                    <TextInput
                      className="min-h-24 rounded-md border border-border bg-muted p-2 text-lg leading-6 text-foreground"
                      multiline
                      placeholder={t('enterYourTranscription')}
                      placeholderTextColor="#6B7280"
                      value={editedText}
                      onChangeText={setEditedText}
                      autoFocus
                    />
                  ) : (
                    <Text className="text-lg leading-6 text-foreground">
                      {translationData.text || '(No text)'}
                    </Text>
                  )}
                </View>

                {/* Audio Player */}
                {translationData.audio && getAudioUri() && !isEditing && (
                  <View className="mb-4 rounded-md bg-muted p-4">
                    <AudioPlayer
                      audioUri={getAudioUri()}
                      useCarousel={false}
                      mini={false}
                    />
                  </View>
                )}

                {/* Submit button for transcription */}
                {isEditing && (
                  <Button
                    variant="default"
                    onPress={handleSubmitTranscription}
                    disabled={!editedText.trim() || isTranscribing}
                    className="mt-4"
                  >
                    {isTranscribing ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text className="font-bold text-primary-foreground">
                        {t('submitTranscription')}
                      </Text>
                    )}
                  </Button>
                )}

                {/* Voting Section with PrivateAccessGate */}
                {!isOwnTranslation &&
                  currentUser &&
                  !isEditing &&
                  !hasReported &&
                  allowEditing && (
                    <PrivateAccessGate
                      projectId={projectId || ''}
                      projectName={projectName || ''}
                      isPrivate={isPrivateProject}
                      action="vote"
                      inline={true}
                    >
                      <View className="mb-2.5 border-b border-foreground">
                        <Text className="text-center text-base font-bold text-foreground">
                          {t('voting')}
                        </Text>
                      </View>
                      <View className="mb-0 w-full flex-row items-center justify-around">
                        <Button
                          variant={
                            userVote?.polarity === 'up'
                              ? 'default'
                              : 'secondary'
                          }
                          onPress={() => handleVote({ voteType: 'up' })}
                          disabled={isVotePending || !allowEditing}
                          className="flex-row items-center justify-center bg-green-500 px-6 py-3"
                        >
                          {pendingVoteType === 'up' ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <Icon
                              as={ThumbsUpIcon}
                              size={24}
                              className="text-white"
                            />
                          )}
                        </Button>

                        <View className="flex-1 flex-col items-center justify-center rounded-md">
                          <View>
                            <Text className="text-center text-base font-bold text-foreground">
                              Net: {upVotes - downVotes > 0 ? '+' : ''}
                              {upVotes - downVotes}
                            </Text>
                          </View>
                          <View className="w-full flex-1 flex-row justify-between px-4">
                            <Text className="text-base font-bold text-foreground">
                              {upVotes}
                            </Text>
                            <Text className="text-base font-bold text-foreground">
                              {downVotes}
                            </Text>
                          </View>
                        </View>
                        <Button
                          variant={
                            userVote?.polarity === 'down'
                              ? 'default'
                              : 'secondary'
                          }
                          onPress={() => handleVote({ voteType: 'down' })}
                          disabled={isVotePending || !allowEditing}
                          className="flex-row items-center justify-center bg-red-600 px-6 py-3"
                        >
                          {pendingVoteType === 'down' ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <Icon
                              as={ThumbsDownIcon}
                              size={24}
                              className="text-white"
                            />
                          )}
                        </Button>
                      </View>
                    </PrivateAccessGate>
                  )}

                {/* Show login prompt if not logged in */}
                {!currentUser && !isEditing && (
                  <View className="mb-4 flex-row items-center justify-center gap-2 rounded-md bg-muted p-4">
                    <Icon
                      as={UserCircleIcon}
                      size={20}
                      className="text-muted-foreground"
                    />
                    <Text className="text-center text-base text-muted-foreground">
                      {t('pleaseLogInToVoteOnTranslations')}
                    </Text>
                  </View>
                )}
                {isOwnTranslation ? (
                  <TranslationSettingsModal
                    isVisible={showSettingsModal}
                    onClose={() => setShowSettingsModal(false)}
                    translationId={translationId}
                  />
                ) : (
                  <ReportModal
                    isVisible={showReportModal}
                    onClose={() => setShowReportModal(false)}
                    recordId={translationId}
                    recordTable="translations"
                    creatorId={translationData.creator_id}
                    hasAlreadyReported={hasReported}
                    onReportSubmitted={() => refetch()}
                  />
                )}
                {/* Debug Info */}
                {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
                {SHOW_DEV_ELEMENTS && (
                  <View className="mt-4 items-center">
                    <Text className="text-sm text-muted-foreground">
                      {isOnline ? '🟢 Online' : '🔴 Offline'} • ID:{' '}
                      {translationData.id.substring(0, 8)}...
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <Text className="my-8 text-center text-base text-destructive">
                {t('translationNotFound')}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
