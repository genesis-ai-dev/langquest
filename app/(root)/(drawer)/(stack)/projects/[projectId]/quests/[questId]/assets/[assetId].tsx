import CalendarIcon from '@/components/CalendarIcon';
import Carousel from '@/components/Carousel';
import { GemIcon } from '@/components/GemIcon';
import ImageCarousel from '@/components/ImageCarousel';
import KeyboardIcon from '@/components/KeyboardIcon';
import LumpOfCoalIcon from '@/components/LumpOfCoalIcon';
import MicrophoneIcon from '@/components/MicrophoneIcon';
import { NewTranslationModal } from '@/components/NewTranslationModal';
import { PageHeader } from '@/components/PageHeader';
import { PendingCount } from '@/components/PendingCount';
import { PickaxeCount } from '@/components/PickaxeCount';
import PickaxeIcon from '@/components/PickaxeIcon';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { SourceContent } from '@/components/SourceContent';
import { SuccessCount } from '@/components/SuccessCount';
import ThumbsUpIcon from '@/components/ThumbsUpIcon';
import { TranslationModal } from '@/components/TranslationModal';
import WaveformIcon from '@/components/WaveformIcon';
import { useAuth } from '@/contexts/AuthContext';
import type { Asset } from '@/database_services/assetService';
import type { Translation } from '@/database_services/translationService';
import type { Vote } from '@/database_services/voteService';
import type { asset_content_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAssetById, useAssetContent } from '@/hooks/db/useAssets';
import { useLanguageById } from '@/hooks/db/useLanguages';
import { useProjectById } from '@/hooks/db/useProjects';
import type { Language } from '@/hooks/db/useTranslations';
import { useTranslationsWithVotesAndLanguageByAssetId } from '@/hooks/db/useTranslations';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { usePrivateProjectAccess } from '@/hooks/usePrivateProjectAccess';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { calculateVoteCount, getGemColor } from '@/utils/progressUtils';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

const ASSET_VIEWER_PROPORTION = 0.4;

const getFirstAvailableTab = (
  asset: Asset | null,
  assetContent?: (typeof asset_content_link.$inferSelect)[]
): TabType => {
  if (!asset || !assetContent) return 'text';
  const hasText = assetContent.length > 0;
  const hasImages = (asset.images?.length ?? 0) > 0;

  if (hasText) return 'text';
  if (hasImages) return 'image';
  return 'text'; // fallback
};

type TabType = 'text' | 'image';
type SortOption = 'voteCount' | 'dateSubmitted';

export default function AssetView() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const { assetId, projectId } = useLocalSearchParams<{
    assetId: string;
    projectId: string;
  }>();
  const [selectedTranslationId, setSelectedTranslationId] = useState<
    string | null
  >(null);
  const [sortOption, setSortOption] = useState<SortOption>('voteCount');

  useEffect(() => {
    if (!assetId) return;
    void system.tempAttachmentQueue?.loadAssetAttachments(assetId);
  }, [assetId]);

  enum TranslationModalType {
    TEXT = 'text',
    AUDIO = 'audio'
  }

  const [translationModalType, setTranslationModalType] =
    useState<TranslationModalType>(TranslationModalType.TEXT);
  const [isTranslationModalVisible, setIsTranslationModalVisible] =
    useState(false);
  const [showPrivateAccessModal, setShowPrivateAccessModal] = useState(false);
  const [pendingTranslationType, setPendingTranslationType] =
    useState<TranslationModalType | null>(null);

  const { project: activeProject } = useProjectById(projectId);

  // Check private project access
  const { hasAccess } = usePrivateProjectAccess({
    projectId: activeProject?.id || '',
    isPrivate: activeProject?.private || false
  });

  const screenHeight = Dimensions.get('window').height;
  const assetViewerHeight = screenHeight * ASSET_VIEWER_PROPORTION;
  const translationsContainerHeight = screenHeight - assetViewerHeight - 100;

  // Use the hook to watch attachment states
  const { asset, isAssetLoading } = useAssetById(assetId);
  const { assetContent, isAssetContentLoading } = useAssetContent(assetId);
  const {
    language: sourceLanguage,
    isLanguageLoading: isSourceLanguageLoading
  } = useLanguageById(asset?.source_language_id);
  const { translationsWithVotesAndLanguage, refetch } =
    useTranslationsWithVotesAndLanguageByAssetId(assetId);

  const isLoading =
    isAssetLoading || isAssetContentLoading || isSourceLanguageLoading;

  const allAttachmentIds = React.useMemo(() => {
    if (!asset || !assetContent || !translationsWithVotesAndLanguage) return [];

    // Collect all attachment IDs
    const contentAudioIds = assetContent
      .filter((content) => content.audio_id)
      .map((content) => content.audio_id!)
      .filter(Boolean);

    console.log('contentAudioIds', contentAudioIds);

    const translationAudioIds = translationsWithVotesAndLanguage
      .filter((translation) => translation.audio)
      .map((translation) => translation.audio)
      .filter(Boolean);

    return [contentAudioIds, asset.images ?? [], translationAudioIds].flat();
  }, [asset, assetContent, translationsWithVotesAndLanguage]);

  const { attachmentStates, isLoading: isLoadingAttachments } =
    useAttachmentStates(allAttachmentIds);

  const getPreviewText = (fullText: string, maxLength = 50) => {
    if (fullText.length <= maxLength) return fullText;
    return fullText.substring(0, maxLength).trim() + '...';
  };

  type VoteIconName =
    | 'thumbs-up'
    | 'thumbs-up-outline'
    | 'thumbs-down'
    | 'thumbs-down-outline';

  const getVoteIconName = (
    translationId: string,
    voteType: 'up' | 'down'
  ): VoteIconName => {
    if (!currentUser) return `thumbs-${voteType}-outline` as VoteIconName;

    const votes: Vote[] =
      translationsWithVotesAndLanguage?.find(
        (translation) => translation.id === translationId
      )?.votes ?? [];
    const userVote = votes.find((vote) => vote.creator_id === currentUser.id);

    if (!userVote) return `thumbs-${voteType}-outline` as VoteIconName;
    return userVote.polarity === voteType
      ? (`thumbs-${voteType}` as VoteIconName)
      : (`thumbs-${voteType}-outline` as VoteIconName);
  };

  // Set the first available tab when asset or assetContent changes
  useEffect(() => {
    if (!asset || !assetContent) return;
    const firstAvailableTab = getFirstAvailableTab(asset, assetContent);
    setActiveTab(firstAvailableTab);
  }, [asset, assetContent]);

  const renderTranslationCard = ({
    item: translation
  }: {
    item: Translation & { votes: Vote[]; target_language: Language };
  }) => {
    const votes =
      translationsWithVotesAndLanguage?.find((t) => t.id === translation.id)
        ?.votes ?? [];
    const voteCount = calculateVoteCount(votes);
    if (!currentUser) {
      return null;
    }
    const gemColor = getGemColor(translation, votes, currentUser.id);

    const translationHasAudio = !!translation.audio;
    const audioIconOpacity = translationHasAudio ? 1 : 0.5;

    const translationHasText = !!translation.text;
    const textIconOpacity = translationHasText ? 1 : 0.5;

    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          flex: 1,
          minHeight: 100,
          opacity: gemColor === colors.downVoted ? 0.5 : 1
        }}
      >
        {/* Gem or Pickaxe icon */}
        {gemColor === colors.alert ? (
          <PickaxeIcon color={gemColor} width={20} height={20} />
        ) : gemColor === colors.downVoted ? (
          <LumpOfCoalIcon color={gemColor} width={20} height={20} />
        ) : (
          <GemIcon color={gemColor} width={20} height={20} />
        )}
        <TouchableOpacity
          style={[styles.translationCard, { flex: 1 }]}
          onPress={() => setSelectedTranslationId(translation.id)}
        >
          <View
            style={[
              styles.translationCardContent,
              { gap: 12, alignItems: 'center', flex: 1 }
            ]}
          >
            {translationHasAudio && (
              <WaveformIcon
                color={colors.text}
                width={translationHasText ? 30 : 80}
                opacity={audioIconOpacity}
              />
            )}
            <View style={styles.translationCardLeft}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text style={styles.translationPreview} numberOfLines={2}>
                  {getPreviewText(translation.text ?? '')}
                </Text>
              </View>
            </View>
            <View style={styles.translationCardRight}>
              <View style={styles.voteContainer}>
                <Ionicons
                  name={getVoteIconName(translation.id, 'up')}
                  size={16}
                  color={colors.text}
                />
                <Text style={styles.voteCount}>{voteCount}</Text>
                <Ionicons
                  name={getVoteIconName(translation.id, 'down')}
                  size={16}
                  color={colors.text}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
        <View style={{ flexDirection: 'column', gap: 6 }}>
          <View
            style={{
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <MicrophoneIcon
              fill={colors.text}
              opacity={audioIconOpacity}
              width={16}
              height={16}
            />
            <Text
              style={{
                color: colors.text,
                fontSize: 10,
                opacity: audioIconOpacity
              }}
            >
              {'00:00'}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: textIconOpacity
            }}
          >
            <KeyboardIcon fill={colors.text} width={16} height={16} />
            <Text style={{ color: colors.text, fontSize: 10 }}>...</Text>
          </View>
        </View>
      </View>
    );
  };

  const handleNewTranslation = () => {
    try {
      // Refresh translations after creating new one
      void refetch();
      setIsTranslationModalVisible(false);
    } catch (error) {
      console.error('Error creating translation:', error);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.content}>
            <View style={{ padding: spacing.medium }}>
              <PageHeader title={asset?.name ?? ''} />
            </View>
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'text' && styles.activeTab,
                  !assetContent?.length && styles.disabledTab
                ]}
                onPress={() => setActiveTab('text')}
                disabled={!assetContent?.length}
              >
                <Ionicons
                  name="text"
                  size={24}
                  color={
                    assetContent?.length ? colors.text : colors.textSecondary
                  }
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'image' && styles.activeTab,
                  !(asset?.images?.length ?? 0) && styles.disabledTab
                ]}
                onPress={() =>
                  (asset?.images?.length ?? 0) > 0 && setActiveTab('image')
                }
                disabled={!(asset?.images?.length ?? 0)}
              >
                <Ionicons
                  name="image"
                  size={24}
                  color={
                    (asset?.images?.length ?? 0) > 0
                      ? colors.text
                      : colors.textSecondary
                  }
                />
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <ActivityIndicator size="large" />
            ) : (
              <View style={[styles.assetViewer, { height: assetViewerHeight }]}>
                {activeTab === 'text' &&
                  assetContent &&
                  assetContent.length > 0 && (
                    <View style={styles.carouselWrapper}>
                      <Carousel
                        items={assetContent}
                        renderItem={(content) => {
                          return (
                            <SourceContent
                              content={content}
                              sourceLanguage={sourceLanguage ?? null}
                              audioUri={
                                content.audio_id
                                  ? (() => {
                                      const localUri = attachmentStates.get(
                                        content.audio_id
                                      )?.local_uri;
                                      return localUri
                                        ? system.permAttachmentQueue?.getLocalUri(
                                            localUri
                                          )
                                        : null;
                                    })()
                                  : null
                              }
                              isLoading={isLoading}
                            />
                          );
                        }}
                      />
                    </View>
                  )}
                {activeTab === 'image' && (
                  <ImageCarousel
                    uris={
                      asset?.images
                        ?.map((imageId) => {
                          const localUri =
                            attachmentStates.get(imageId)?.local_uri;
                          return localUri
                            ? system.permAttachmentQueue?.getLocalUri(localUri)
                            : null;
                        })
                        .filter(Boolean) ?? []
                    }
                  />
                )}
              </View>
            )}

            <View style={styles.horizontalLine} />

            <ScrollView style={[{ height: translationsContainerHeight }]}>
              <View style={styles.translationHeader}>
                <View
                  style={[
                    styles.alignmentContainer,
                    { gap: 12, flexDirection: 'row', alignItems: 'center' }
                  ]}
                >
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <SuccessCount
                      count={
                        (
                          translationsWithVotesAndLanguage?.filter(
                            (translation) => {
                              const gemColor = getGemColor(
                                translation,
                                translation.votes,
                                currentUser?.id ?? null
                              );
                              return gemColor === colors.success;
                            }
                          ) ?? []
                        ).length
                      }
                    />
                    <PendingCount
                      count={
                        (
                          translationsWithVotesAndLanguage?.filter(
                            (translation) => {
                              const gemColor = getGemColor(
                                translation,
                                translation.votes,
                                currentUser?.id ?? null
                              );
                              return gemColor === colors.textSecondary;
                            }
                          ) ?? []
                        ).length
                      }
                    />

                    <PickaxeCount
                      count={
                        (
                          translationsWithVotesAndLanguage?.filter(
                            (translation) => {
                              const gemColor = getGemColor(
                                translation,
                                translation.votes,
                                currentUser?.id ?? null
                              );
                              return gemColor === colors.alert;
                            }
                          ) ?? []
                        ).length
                      }
                    />
                  </View>
                  <View style={[{ flexDirection: 'row', gap: 8 }]}>
                    <TouchableOpacity
                      style={[
                        styles.sortButton,
                        styles.sortButtonBorder,
                        sortOption === 'voteCount' && styles.sortButtonSelected
                      ]}
                      onPress={() => {
                        setSortOption('voteCount');
                      }}
                    >
                      <ThumbsUpIcon
                        stroke={
                          sortOption === 'voteCount'
                            ? colors.background
                            : colors.buttonText
                        }
                        fill={colors.buttonText}
                        width={16}
                        height={16}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.sortButton,
                        styles.sortButtonBorder,
                        sortOption === 'dateSubmitted' &&
                          styles.sortButtonSelected
                      ]}
                      onPress={() => {
                        setSortOption('dateSubmitted');
                      }}
                    >
                      <CalendarIcon
                        stroke={
                          sortOption === 'dateSubmitted'
                            ? colors.background
                            : colors.buttonText
                        }
                        fill={colors.buttonText}
                        width={16}
                        height={16}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <GestureHandlerRootView style={{ flex: 1 }}>
                <FlashList
                  data={translationsWithVotesAndLanguage?.sort((a, b) => {
                    if (sortOption === 'voteCount') {
                      return (
                        calculateVoteCount(b.votes) -
                        calculateVoteCount(a.votes)
                      );
                    }
                    return (
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                    );
                  })}
                  renderItem={renderTranslationCard}
                  keyExtractor={(item) => item.id}
                  style={styles.translationsList}
                />
              </GestureHandlerRootView>
            </ScrollView>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              style={[
                styles.newTranslationButton,
                { flex: 1, backgroundColor: '#6545B6' }
              ]}
              onPress={() => {
                if (hasAccess) {
                  setIsTranslationModalVisible(true);
                  setTranslationModalType(TranslationModalType.AUDIO);
                } else {
                  setPendingTranslationType(TranslationModalType.AUDIO);
                  setShowPrivateAccessModal(true);
                }
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {!hasAccess && (
                  <Ionicons
                    name="lock-closed"
                    size={16}
                    color={colors.buttonText}
                  />
                )}
                <MicrophoneIcon
                  fill={colors.buttonText}
                  width={24}
                  height={24}
                  opacity={hasAccess ? 1 : 0.6}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.newTranslationButton, { flex: 1 }]}
              onPress={() => {
                if (hasAccess) {
                  setIsTranslationModalVisible(true);
                  setTranslationModalType(TranslationModalType.TEXT);
                } else {
                  setPendingTranslationType(TranslationModalType.TEXT);
                  setShowPrivateAccessModal(true);
                }
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {!hasAccess && (
                  <Ionicons
                    name="lock-closed"
                    size={16}
                    color={colors.buttonText}
                  />
                )}
                <KeyboardIcon
                  fill={colors.buttonText}
                  width={24}
                  height={24}
                  opacity={hasAccess ? 1 : 0.6}
                />
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {selectedTranslationId && (
          <TranslationModal
            translationId={selectedTranslationId}
            onClose={() => setSelectedTranslationId(null)}
          />
        )}

        {isTranslationModalVisible &&
          assetContent &&
          (assetContent.length > 0 ||
            (asset?.images && asset.images.length > 0)) && (
            <NewTranslationModal
              isVisible={isTranslationModalVisible}
              onClose={() => setIsTranslationModalVisible(false)}
              onSubmit={handleNewTranslation}
              asset_id={assetId}
              translationType={translationModalType}
              assetContent={assetContent[activeTab === 'text' ? 0 : 1]}
              sourceLanguage={sourceLanguage}
              attachmentUris={Object.fromEntries(attachmentStates.entries())}
              loadingAttachments={isLoadingAttachments}
            />
          )}

        <PrivateAccessGate
          projectId={activeProject?.id || ''}
          projectName={activeProject?.name || ''}
          isPrivate={activeProject?.private || false}
          action="translate"
          modal={true}
          isVisible={showPrivateAccessModal}
          onClose={() => setShowPrivateAccessModal(false)}
          onMembershipGranted={() => {
            setShowPrivateAccessModal(false);
            if (pendingTranslationType) {
              setIsTranslationModalVisible(true);
              setTranslationModalType(pendingTranslationType);
              setPendingTranslationType(null);
            }
          }}
        />
      </LinearGradient>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.medium
  },
  safeArea: {
    flex: 1
  },
  audioLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: fontSizes.large,
    color: colors.text,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: spacing.small
  },
  disabledTab: {
    opacity: 0.5
  },
  content: {
    flex: 1
  },
  sourceTextContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.medium,
    paddingTop: spacing.medium,
    paddingBottom: spacing.xxlarge,
    marginHorizontal: spacing.small,
    width: '100%',
    flex: 1,
    justifyContent: 'space-between'
  },
  source_languageLabel: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: 'bold',
    marginBottom: spacing.small
  },
  sourceText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginBottom: spacing.medium
  },
  assetViewer: {
    minHeight: 250,
    flex: 1,
    width: '100%'
  },
  horizontalLine: {
    height: 1,
    backgroundColor: colors.inputBorder,
    marginVertical: spacing.medium
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
    marginBottom: spacing.medium
  },
  tab: {
    padding: spacing.medium
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary
  },
  tabContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  translationsList: {
    paddingHorizontal: spacing.large,
    paddingBottom: spacing.medium,
    paddingTop: spacing.medium
  },
  translationHeader: {
    paddingHorizontal: spacing.large
  },
  alignmentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  dropdownContainer: {
    flex: 1
  },
  newTranslationButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.medium,
    height: 50
  },
  newTranslationButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginLeft: spacing.small
  },
  translationCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium
  },
  translationCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  translationCardLeft: {
    flex: 1,
    marginRight: spacing.small
  },
  translationCardRight: {
    alignItems: 'flex-end'
  },
  translationPreview: {
    color: colors.text,
    fontSize: fontSizes.medium,
    marginBottom: spacing.small
  },
  translatorInfo: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    marginBottom: spacing.xsmall
  },
  dateSubmitted: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small
  },
  voteCount: {
    color: colors.text,
    fontSize: fontSizes.small
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.small
  },
  audioIndicator: {
    // marginTop: spacing.medium,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.small
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.medium
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: colors.textSecondary
  },
  paginationDotActive: {
    backgroundColor: colors.primary
  },
  arrowButton: {
    padding: spacing.small,
    borderRadius: borderRadius.medium
  },
  arrowButtonDisabled: {
    opacity: 0.5
  },
  carouselWrapper: {
    flex: 1,
    paddingHorizontal: spacing.medium
  },
  sortButton: {
    padding: 8
  },
  sortButtonBorder: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.buttonText
  },
  sortButtonSelected: {
    backgroundColor: colors.buttonText
  }
});
