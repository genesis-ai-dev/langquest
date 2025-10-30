import AudioPlayer from '@/components/AudioPlayer';
import { ReportModal } from '@/components/NewReportModal';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { TranslationSettingsModal } from '@/components/TranslationSettingsModal';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { LayerStatus } from '@/database_services/types';
import { voteService } from '@/database_services/voteService';
import { asset } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useHasUserReported } from '@/hooks/useReports';
import { resolveTable } from '@/utils/dbUtils';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { getLocalAttachmentUriWithOPFS } from '@/utils/fileUtils';
import { cn, getThemeColor } from '@/utils/styleUtils';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Alert as RNAlert,
  ScrollView,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useHybridData } from './useHybridData';

interface NextGenTranslationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  onVoteSuccess?: () => void;
  canVote?: boolean;
  isPrivateProject?: boolean;
  projectId?: string;
  projectName?: string;
}

function useNextGenTranslation(assetId: string) {
  return useHybridData({
    dataType: 'translation',
    queryKeyParams: [assetId],
    offlineQuery: toCompilableQuery(
      system.db.query.asset.findFirst({
        where: eq(asset.id, assetId),
        with: {
          content: true,
          votes: true
        }
      })
    ),
    enabled: !!assetId,
    enableCloudQuery: false
  });
}

export default function NextGenTranslationModal({
  open,
  onOpenChange,
  assetId,
  onVoteSuccess,
  canVote: _canVote = true,
  isPrivateProject = false,
  projectId,
  projectName
}: NextGenTranslationModalProps) {
  const { project } = useProjectById(projectId);
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

  const { data: translationData, isLoading } = useNextGenTranslation(assetId);

  // Get audio attachment states
  const audioIds = translationData.flatMap((t) =>
    t.content.flatMap((c) => c.audio ?? [])
  );
  const { attachmentStates } = useAttachmentStates(audioIds);

  const asset = translationData[0];
  const assetText = asset?.content[0]?.text;
  // Calculate vote counts
  const upVotes =
    asset?.votes.filter((v) => v.active && v.polarity === 'up').length ?? 0;
  const downVotes =
    asset?.votes.filter((v) => v.active && v.polarity === 'down').length ?? 0;
  const userVote = asset?.votes.find((v) => v.creator_id === currentUser?.id);

  const { mutateAsync: handleVote, isPending: isVotePending } = useMutation({
    mutationFn: async ({ voteType }: { voteType: 'up' | 'down' }) => {
      if (!currentUser || !asset) {
        RNAlert.alert(t('error'), t('pleaseLogInToVote'));
        return;
      }
      setPendingVoteType(voteType);

      // If user already voted with the same polarity, deactivate the vote
      if (userVote?.polarity === voteType) {
        await voteService.addVote({
          asset_id: assetId,
          creator_id: currentUser.id,
          vote_id: userVote.id,
          polarity: voteType,
          active: false
        });
      } else {
        // Otherwise, add/update the vote
        await voteService.addVote({
          asset_id: assetId,
          creator_id: currentUser.id,
          vote_id: userVote?.id,
          polarity: voteType
        });
      }

      await queryClient.invalidateQueries({
        queryKey: ['translation', 'nextgen', assetId]
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

  const getAudioSegments = () => {
    if (!asset?.content.flatMap((c) => c.audio).length) return [];
    return asset.content
      .flatMap((c) => c.audio)
      .filter(Boolean)
      .map((audio) =>
        getLocalAttachmentUriWithOPFS(
          attachmentStates.get(audio)?.local_uri ?? ''
        )
      )
      .filter(Boolean);
  };

  const audioSegments = getAudioSegments();

  const isOwnTranslation = currentUser?.id === asset?.creator_id;

  const {
    hasReported,
    isLoading: isReportLoading,
    refetch
  } = useHasUserReported(asset?.id || '', 'assets');

  // Initialize edited text when translation data loads
  React.useEffect(() => {
    if (assetText) {
      setEditedText(assetText);
    }
  }, [assetText]);

  const { mutate: createTranscription, isPending: isTranscribing } =
    useMutation({
      mutationFn: async () => {
        if (!currentUser || !asset) {
          throw new Error('Missing required data');
        }

        if (!editedText.trim()) {
          throw new Error('Please enter a transcription');
        }

        if (!project) {
          throw new Error('Project is required');
        }

        const translationAudio = asset.content
          .flatMap((c) => c.audio)
          .filter(Boolean);
        await system.db.transaction(async (tx) => {
          const [newAsset] = await tx
            .insert(
              resolveTable('asset', {
                localOverride: project.source === 'local'
              })
            )
            .values({
              name: asset.name,
              source_language_id: asset.source_language_id,
              source_asset_id: asset.id,
              creator_id: currentUser.id,
              project_id: project.id
            })
            .returning();
          if (!newAsset) {
            throw new Error('Failed to insert asset');
          }
          await tx
            .insert(
              resolveTable('asset_content_link', {
                localOverride: project.source === 'local'
              })
            )
            .values({
              text: editedText.trim(),
              asset_id: newAsset.id,
              source_language_id: asset.source_language_id,
              ...(translationAudio.length > 0
                ? { audio: translationAudio }
                : {})
            });
        });
      },
      onSuccess: () => {
        RNAlert.alert(t('success'), t('yourTranscriptionHasBeenSubmitted'));
        setIsEditing(false);
        onVoteSuccess?.(); // Refresh the list
        onOpenChange(false);
      },
      onError: (error) => {
        console.error('Error creating transcription:', error);
        RNAlert.alert(t('error'), t('failedToCreateTranscription'));
      }
    });

  const toggleEdit = () => {
    if (isEditing) {
      // Cancel editing
      setIsEditing(false);
      setEditedText(assetText ?? '');
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
    LayerType.ASSET,
    asset?.id || '',
    asset as LayerStatus
  );

  const { stopCurrentSound, isPlaying } = useAudio();

  const handleClose = async () => {
    onOpenChange(false);
    setShowReportModal(false);
    setShowSettingsModal(false);
    setIsEditing(false);
    if (isPlaying) {
      await stopCurrentSound();
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View className="flex-1 items-center justify-center bg-black/50">
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View className="h-[85%] max-h-[700px] w-[90%] rounded-lg bg-background">
                {/* Header */}
                <View className="flex-row items-center justify-between border-b border-border p-4">
                  <Text variant="h4">{t('translation')}</Text>
                  <View className="flex-row items-center gap-2">
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
                              className={
                                hasAccess
                                  ? 'text-primary'
                                  : 'text-muted-foreground'
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
                            hasReported
                              ? 'text-muted-foreground'
                              : 'text-foreground'
                          }
                        />
                      </Button>
                    )}
                    <Pressable onPress={handleClose} className="p-2">
                      <Ionicons
                        name="close"
                        size={24}
                        color={getThemeColor('foreground')}
                      />
                    </Pressable>
                  </View>
                </View>

                <ScrollView
                  className="flex-1 px-4 py-4"
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {isLoading ? (
                    <View className="py-8">
                      <ActivityIndicator
                        size="large"
                        color={getThemeColor('primary')}
                      />
                    </View>
                  ) : asset ? (
                    <View className="flex-col gap-4">
                      {/* Translation Text */}
                      {isEditing ? (
                        <Textarea
                          placeholder={t('enterYourTranscription')}
                          value={editedText}
                          onChangeText={setEditedText}
                          autoFocus
                          size="sm"
                        />
                      ) : (
                        <Text
                          className={cn(
                            'text-lg leading-6 text-foreground',
                            !assetText && 'italic text-muted-foreground'
                          )}
                        >
                          {assetText || '(No text)'}
                        </Text>
                      )}

                      {/* Audio Player */}
                      {audioSegments.length > 0 && !isEditing && (
                        <View>
                          <AudioPlayer
                            audioSegments={audioSegments}
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
                          loading={isTranscribing}
                        >
                          <Text>{t('submitTranscription')}</Text>
                        </Button>
                      )}

                      {/* Voting Section with PrivateAccessGate */}
                      {!isOwnTranslation &&
                        currentUser &&
                        !isEditing &&
                        !hasReported && (
                          <PrivateAccessGate
                            projectId={projectId || ''}
                            projectName={projectName || ''}
                            isPrivate={isPrivateProject}
                            action="vote"
                            inline={true}
                          >
                            <View className="flex-col gap-2.5">
                              <View className="border-b border-foreground">
                                <Text className="text-center text-base font-bold text-foreground">
                                  {t('voting')}
                                </Text>
                              </View>
                              <View className="w-full flex-row items-center justify-around">
                                <Button
                                  variant={
                                    userVote?.polarity === 'up'
                                      ? 'default'
                                      : 'secondary'
                                  }
                                  onPress={() => handleVote({ voteType: 'up' })}
                                  disabled={isVotePending}
                                  className="flex-row items-center justify-center bg-green-500 px-6 py-3"
                                >
                                  {pendingVoteType === 'up' ? (
                                    <ActivityIndicator
                                      size="small"
                                      color="white"
                                    />
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
                                  onPress={() =>
                                    handleVote({ voteType: 'down' })
                                  }
                                  disabled={isVotePending}
                                  className="flex-row items-center justify-center bg-red-600 px-6 py-3"
                                >
                                  {pendingVoteType === 'down' ? (
                                    <ActivityIndicator
                                      size="small"
                                      color="white"
                                    />
                                  ) : (
                                    <Icon
                                      as={ThumbsDownIcon}
                                      size={24}
                                      className="text-white"
                                    />
                                  )}
                                </Button>
                              </View>
                            </View>
                          </PrivateAccessGate>
                        )}

                      {/* Show login prompt if not logged in */}
                      {!currentUser && !isEditing && (
                        <Alert icon={UserCircleIcon}>
                          <AlertTitle>
                            {t('pleaseLogInToVoteOnTranslations')}
                          </AlertTitle>
                        </Alert>
                      )}
                      {isOwnTranslation ? (
                        <TranslationSettingsModal
                          isVisible={showSettingsModal}
                          onClose={() => setShowSettingsModal(false)}
                          translationId={assetId}
                        />
                      ) : (
                        <ReportModal
                          isVisible={showReportModal}
                          onClose={() => setShowReportModal(false)}
                          recordId={assetId}
                          recordTable="asset"
                          creatorId={asset.creator_id ?? undefined}
                          hasAlreadyReported={hasReported}
                          onReportSubmitted={(contentBlocked) => {
                            refetch();
                            // Close the translation modal if content was blocked
                            if (contentBlocked) {
                              handleClose();
                            }
                          }}
                        />
                      )}
                      {/* Debug Info */}
                      {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
                      {SHOW_DEV_ELEMENTS && (
                        <View className="items-center">
                          <Text className="text-sm text-muted-foreground">
                            {isOnline ? '🟢 Online' : '🔴 Offline'} • ID:{' '}
                            {asset.id.substring(0, 8)}...
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View className="py-8">
                      <Text className="text-center text-base text-destructive">
                        {t('translationNotFound')}
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}
