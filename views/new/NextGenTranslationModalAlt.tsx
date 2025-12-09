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
import type { asset_content_link } from '@/db/drizzleSchema';
import { asset } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useHasUserReported } from '@/hooks/useReports';
import { useTranscription } from '@/hooks/useTranscription';
import { useLocalStore } from '@/store/localStore';
import { resolveTable } from '@/utils/dbUtils';
import { SHOW_DEV_ELEMENTS } from '@/utils/featureFlags';
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
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import RNAlert from '@blazejkustra/react-native-alert';
import {
  KeyboardAwareScrollView,
  KeyboardToolbar
} from 'react-native-keyboard-controller';
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
  const { isAuthenticated } = useAuth();
  const isPowerSyncReady = React.useMemo(
    () => system.isPowerSyncInitialized(),
    []
  );

  // Only create offline query if PowerSync is initialized and user is authenticated
  const offlineQuery = React.useMemo(() => {
    if (!isPowerSyncReady || !isAuthenticated) {
      return 'SELECT * FROM asset WHERE 1=0' as any;
    }
    return toCompilableQuery(
      system.db.query.asset.findFirst({
        where: eq(asset.id, assetId),
        with: {
          content: true,
          votes: true
        }
      })
    );
  }, [assetId, isPowerSyncReady, isAuthenticated]);

  return useHybridData<
    Omit<typeof asset.$inferSelect, 'images'> & {
      images: string[];
      content: (typeof asset_content_link.$inferSelect)[];
      votes: {
        id: string;
        asset_id: string;
        creator_id: string;
        polarity: 'up' | 'down';
        active: boolean;
        created_at: string;
      }[];
    }
  >({
    dataType: 'translation',
    queryKeyParams: [assetId],
    offlineQuery,
    cloudQueryFn: async () => {
      if (!assetId) return [];

      // Fetch asset with content and votes from Supabase
      const { data, error } = await system.supabaseConnector.client
        .from('asset')
        .select(
          `
          *,
          content:asset_content_link (
            *
          ),
          votes:vote (
            *
          )
        `
        )
        .eq('id', assetId)
        .limit(1)
        .overrideTypes<
          (Omit<typeof asset.$inferSelect, 'images'> & {
            images: string;
            content?: (typeof asset_content_link.$inferSelect)[];
            votes?: {
              id: string;
              asset_id: string;
              creator_id: string;
              polarity: 'up' | 'down';
              active: boolean;
              created_at: string;
            }[];
          })[]
        >();

      if (error) throw error;

      // Parse images JSON
      return data.map((item) => {
        const parsedImages = item.images
          ? (JSON.parse(item.images) as string[])
          : [];

        return {
          ...item,
          images: parsedImages,
          content: item.content || [],
          votes: item.votes || []
        };
      });
    },
    enabled: !!assetId,
    enableCloudQuery: !!assetId,
    enableOfflineQuery: !!assetId
  });
}

export default function NextGenTranslationModal({
  open,
  onOpenChange,
  assetId,
  onVoteSuccess,
  isPrivateProject = false,
  projectId,
  projectName
}: NextGenTranslationModalProps) {
  const { project } = useProjectById(projectId);
  const { currentQuestId } = useAppNavigation();
  const { t } = useLocalization();
  const { currentUser, isAuthenticated } = useAuth();
  const setAuthView = useLocalStore((state) => state.setAuthView);
  const isOnline = useNetworkStatus();
  const queryClient = useQueryClient();
  const [pendingVoteType, setPendingVoteType] = useState<'up' | 'down' | null>(
    null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const { mutateAsync: transcribeAudio, isPending: isTranscribing } =
    useTranscription();

  const { data: translationData, isLoading } = useNextGenTranslation(assetId);

  const audioIds = React.useMemo(() => {
    return translationData.flatMap((t) =>
      t.content.flatMap((c) => c.audio ?? [])
    );
  }, [translationData]);

  const { attachmentStates } = useAttachmentStates(audioIds);

  const asset = translationData[0];
  const assetText = asset?.content[0]?.text;
  // Calculate vote counts
  const votes = asset?.votes ?? [];
  const upVotes = votes.filter((v) => v.active && v.polarity === 'up').length;
  const downVotes = votes.filter(
    (v) => v.active && v.polarity === 'down'
  ).length;
  const userVote = votes.find((v) => v.creator_id === currentUser?.id);

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

  const [audioSegments, setAudioSegments] = useState<string[]>([]);

  useEffect(() => {
    const loadAudioSegments = async () => {
      if (!asset?.content) {
        setAudioSegments([]);
        return;
      }
      const audioIds = asset.content
        .flatMap((c) => c.audio ?? [])
        .filter(Boolean);
      const segments = await Promise.all(
        audioIds.map((audio) =>
          getLocalAttachmentUriWithOPFS(
            attachmentStates.get(audio)?.local_uri ?? ''
          )
        )
      );
      setAudioSegments(segments.filter(Boolean));
    };
    void loadAudioSegments();
  }, [asset?.content, attachmentStates]);

  const isOwnTranslation = currentUser?.id === asset?.creator_id;

  const {
    hasReported,
    isLoading: isReportLoading,
    refetch
  } = useHasUserReported(asset?.id || '', 'assets');

  React.useEffect(() => {
    if (assetText !== undefined) {
      setEditedText(assetText ?? '');
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

        if (!currentQuestId) {
          throw new Error(
            'Quest context is missing. This is an unexpected error.'
          );
        }

        // Get the original source asset ID (the asset being translated, not the translation itself)
        const originalSourceAssetId = asset.source_asset_id || asset.id;

        // Get languoid_id from asset_content_link (prefer languoid_id, fallback to source_language_id)
        const firstContent = asset.content?.[0];
        const sourceLanguoidId =
          firstContent?.languoid_id ||
          firstContent?.source_language_id ||
          asset.source_language_id;

        if (!sourceLanguoidId) {
          throw new Error(
            'Source languoid is missing. This is an unexpected error.'
          );
        }

        const translationAudio = asset.content
          .flatMap((c) => c.audio ?? [])
          .filter(Boolean);
        await system.db.transaction(async (tx) => {
          // Create a new asset that points to the original source asset
          const [newAsset] = await tx
            .insert(resolveTable('asset')) // Use synced table like the working version
            .values({
              name: asset.name,
              source_language_id: sourceLanguoidId, // Deprecated field, kept for backward compatibility
              source_asset_id: originalSourceAssetId, // Point to the original asset being translated
              creator_id: currentUser.id,
              project_id: project.id,
              download_profiles: [currentUser.id]
            })
            .returning();

          if (!newAsset) {
            throw new Error('Failed to insert asset');
          }

          // Create asset_content_link with the transcribed text and audio
          const contentValues: {
            asset_id: string;
            source_language_id: string | null; // Deprecated field, kept for backward compatibility
            languoid_id: string; // New languoid reference
            download_profiles: string[];
            text?: string;
            audio?: string[];
          } = {
            asset_id: newAsset.id,
            source_language_id: sourceLanguoidId, // Deprecated field, kept for backward compatibility
            languoid_id: sourceLanguoidId, // New languoid reference
            download_profiles: [currentUser.id],
            text: editedText.trim()
          };

          // Add audio if it exists
          if (translationAudio.length > 0) {
            contentValues.audio = translationAudio;
          }

          console.log(
            '[CREATE TRANSCRIPTION] Inserting asset_content_link:',
            JSON.stringify(contentValues, null, 2)
          );

          await tx
            .insert(resolveTable('asset_content_link'))
            .values(contentValues);

          // Create quest_asset_link (composite primary key: quest_id + asset_id, no id field)
          await tx.insert(resolveTable('quest_asset_link')).values({
            quest_id: currentQuestId,
            asset_id: newAsset.id,
            download_profiles: [currentUser.id]
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
      // Cancel editing - reset to original text
      setIsEditing(false);
      setEditedText(assetText ?? '');
    } else {
      // Start editing - ensure we have the current text
      setEditedText(assetText ?? '');
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

  const handleTranscribe = async (uri: string) => {
    if (!isAuthenticated) {
      RNAlert.alert(t('error'), t('pleaseLogInToTranscribe') || 'Please log in to transcribe audio');
      return;
    }

    try {
      const result = await transcribeAudio({ uri, mimeType: 'audio/wav' });
      if (result.text) {
        setEditedText(result.text);
        setIsEditing(true);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      RNAlert.alert(
        t('error'),
        t('transcriptionFailed') || 'Failed to transcribe audio. Please try again.'
      );
    }
  };

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

              <KeyboardAwareScrollView
                className="flex-1"
                contentContainerClassName="px-4 py-4"
                bottomOffset={96}
                extraKeyboardSpace={20}
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
                        drawerInput={false}
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
                          onTranscribe={
                            isAuthenticated && allowEditing
                              ? handleTranscribe
                              : undefined
                          }
                          isTranscribing={isTranscribing}
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
                      !isEditing &&
                      !hasReported &&
                      // Show login prompt for anonymous users
                      (!isAuthenticated ? (
                        <Alert icon={UserCircleIcon}>
                          <AlertTitle>
                            {t('pleaseLogInToVoteOnTranslations')}
                          </AlertTitle>
                          <Button
                            onPress={() => {
                              onOpenChange(false);
                              setAuthView('sign-in');
                            }}
                            className="mt-4"
                          >
                            <Text>{t('signIn') || 'Sign In'}</Text>
                          </Button>
                        </Alert>
                      ) : (
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
                                onPress={() => handleVote({ voteType: 'down' })}
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
                      ))}
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
                          void refetch();
                          // Close the translation modal if content was blocked
                          if (contentBlocked) {
                            void handleClose();
                          }
                        }}
                      />
                    )}
                    {/* Debug Info */}
                    {}
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
              </KeyboardAwareScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
      <KeyboardToolbar />
    </Modal>
  );
}
