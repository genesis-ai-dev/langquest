import MiniAudioPlayer from '@/components/MiniAudioPlayer';
import { CustomDropdown } from '@/components/CustomDropdown';
import ImageCarousel from '@/components/ImageCarousel';
import { NewTranslationModal } from '@/components/NewTranslationModal';
import { TranslationModal } from '@/components/TranslationModal';
import { useAuth } from '@/contexts/AuthContext';
import { Asset, assetService } from '@/database_services/assetService';
import { languageService } from '@/database_services/languageService';
import {
  Translation,
  translationService
} from '@/database_services/translationService';
import { Profile, profileService } from '@/database_services/profileService';
import { Vote, voteService } from '@/database_services/voteService';
import { asset_content_link, language } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import {
  getLocalUriFromAssetId,
  ensureAssetLoaded
} from '@/utils/attachmentUtils';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator
} from 'react-native';
import { FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Carousel from '@/components/Carousel';
import { PageHeader } from '@/components/PageHeader';
import { useSystem } from '@/contexts/SystemContext';

// Debug flag
const DEBUG = false;

// Custom debug function
function debug(...args: any[]) {
  if (DEBUG) {
    console.log('[DEBUG assetView]', ...args);
  }
}

const ASSET_VIEWER_PROPORTION = 0.4;

const getFirstAvailableTab = (
  asset: Asset | null,
  assetContent: (typeof asset_content_link.$inferSelect)[]
): TabType => {
  if (!asset) return 'text';
  const hasText = assetContent.length > 0;
  const hasImages = (asset?.images?.length ?? 0) > 0;

  if (hasText) return 'text';
  if (hasImages) return 'image';
  return 'text'; // fallback
};

type TabType = 'text' | 'image';
type SortOption = 'voteCount' | 'dateSubmitted';

export default function AssetView() {
  const system = useSystem();
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const [currentPage, setCurrentPage] = useState(0);
  const { assetId } = useGlobalSearchParams<{
    assetId: string;
  }>();
  const [asset, setAsset] = useState<Asset>();
  const [assetContent, setAssetContent] = useState<
    (typeof asset_content_link.$inferSelect)[]
  >([]);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('voteCount');
  const [selectedTranslation, setSelectedTranslation] =
    useState<Translation | null>(null);
  const [isNewTranslationModalVisible, setIsNewTranslationModalVisible] =
    useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceLanguage, setSourceLanguage] = useState<
    typeof language.$inferSelect | null
  >(null);
  const [translationVotes, setTranslationVotes] = useState<
    Record<string, Vote[]>
  >({});
  const [translationCreators, setTranslationCreators] = useState<
    Record<string, Profile>
  >({});
  const [translationLanguages, setTranslationLanguages] = useState<
    Record<string, typeof language.$inferSelect>
  >({});

  const screenHeight = Dimensions.get('window').height;
  const assetViewerHeight = screenHeight * ASSET_VIEWER_PROPORTION;
  const translationsContainerHeight = screenHeight - assetViewerHeight - 100;

  const calculateVoteCount = (votes: Vote[]): number => {
    return votes.reduce(
      (acc, vote) => acc + (vote.polarity === 'up' ? 1 : -1),
      0
    );
  };

  const allAttachmentIds = React.useMemo(() => {
    if (!asset || !assetContent) return [];

    // Collect all attachment IDs
    const contentAudioIds = assetContent
      .filter((content) => content.audio_id)
      .map((content) => content.audio_id!)
      .filter(Boolean); // Remove any undefined values

    const imageIds = asset?.images || [];

    const translationAudioIds = translations
      .filter((translation) => translation.audio)
      .map((translation) => translation.audio!)
      .filter(Boolean);

    return [...contentAudioIds, ...imageIds, ...translationAudioIds];
  }, [asset, assetContent, translations]);

  // Use the hook to watch attachment states
  const { attachmentUris, loadingAttachments } =
    useAttachmentStates(allAttachmentIds);

  useEffect(() => {
    loadAssetAndTranslations();

    // Load attachments into temp queue
    if (assetId) {
      system.tempAttachmentQueue?.loadAssetAttachments(assetId);
    }
  }, [assetId]);

  useEffect(() => {
    const abortController = new AbortController();

    system.powersync.watch(
      `SELECT * FROM translation WHERE asset_id = ?`,
      [assetId],
      {
        onResult: () => {
          loadAssetAndTranslations();
        }
      },

      { signal: abortController.signal }
    );

    return () => {
      abortController.abort();
    };
  }, [assetId]);

  useEffect(() => {
    const abortController = new AbortController();

    system.powersync.watch(
      `SELECT * FROM vote WHERE translation_id IN (SELECT id FROM translation WHERE asset_id = ?)`,
      [assetId],
      {
        onResult: async () => {
          // Instead of trying to use the result directly, let's fetch the votes again
          try {
            const votesMap: Record<string, Vote[]> = {};
            await Promise.all(
              translations.map(async (translation) => {
                votesMap[translation.id] =
                  await voteService.getVotesByTranslationId(translation.id);
              })
            );
            console.log('Updated votes map:', votesMap); // Debug log
            setTranslationVotes(votesMap);
          } catch (error) {
            console.error('Error updating votes:', error);
          }
        }
      },
      { signal: abortController.signal }
    );

    return () => {
      abortController.abort();
    };
  }, [assetId, translations]);

  const loadAssetAndTranslations = async () => {
    try {
      if (!assetId) return;
      setIsLoading(true);

      // Load asset to retrieve images from its image_ids field
      const loadedAsset = await assetService.getAssetById(assetId);
      if (!loadedAsset) {
        Alert.alert('Error', 'Asset not found');
        return;
      }

      setAsset(loadedAsset);

      // Load asset content to get asset audio and text
      const content = await assetService.getAssetContent(assetId);
      setAssetContent(content);
      setActiveTab(getFirstAvailableTab(loadedAsset, content));

      // Load source language
      const source = await languageService.getLanguageById(
        loadedAsset.source_language_id
      );
      setSourceLanguage(source);

      // Load translations
      const loadedTranslations =
        await translationService.getTranslationsByAssetId(assetId);
      setTranslations(loadedTranslations);

      // After loading asset data, load the URIs
      // await loadAllUris();
    } catch (error) {
      console.error('Error loading asset and translations:', error, assetId);
      Alert.alert('Error', 'Failed to load asset data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (
    translation_id: string,
    polarity: 'up' | 'down'
  ) => {
    if (!currentUser) {
      Alert.alert('Error', t('logInToVote'));
      return;
    }

    try {
      await voteService.addVote({
        translation_id,
        creator_id: currentUser.id,
        polarity
      });
      await loadAssetAndTranslations(); // Reload to get updated vote counts
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', t('failedToVote'));
    }
  };

  const handleNewTranslation = async () => {
    try {
      await loadAssetAndTranslations();
    } catch (error) {
      console.error('Error creating translation:', error);
      Alert.alert('Error', t('failedCreateTranslation'));
    }
  };

  const getPreviewText = (fullText: string, maxLength: number = 50) => {
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

    const votes = translationVotes[translationId] || [];
    const userVote = votes.find((vote) => vote.creator_id === currentUser.id);

    if (!userVote) return `thumbs-${voteType}-outline` as VoteIconName;
    return userVote.polarity === voteType
      ? (`thumbs-${voteType}` as VoteIconName)
      : (`thumbs-${voteType}-outline` as VoteIconName);
  };

  useEffect(() => {
    const loadTranslationData = async () => {
      const votesMap: Record<string, Vote[]> = {};
      const creatorsMap: Record<string, Profile> = {};
      const languagesMap: Record<string, typeof language.$inferSelect> = {};

      await Promise.all(
        translations.map(async (translation) => {
          try {
            debug('Loading data for translation:', translation.id);

            // Load votes
            try {
              votesMap[translation.id] =
                await voteService.getVotesByTranslationId(translation.id);
              debug('Successfully loaded votes for translation:', {
                translationId: translation.id,
                votes: votesMap[translation.id]
              });
            } catch (error) {
              console.error('Failed to load votes for translation:', {
                translationId: translation.id,
                error
              });
              votesMap[translation.id] = [];
            }

            // Load creator
            try {
              debug('before creator', { translation });
              const creator = await profileService.getProfileByUserId(
                translation.creator_id
              );
              debug('after creator', { translation });
              debug('creator', { creator, translation });
              if (creator) {
                creatorsMap[translation.creator_id] = creator;
                debug('Successfully loaded creator:', {
                  creatorId: translation.creator_id,
                  creator
                });
              }
            } catch (error) {
              console.error('Failed to load creator:', {
                creatorId: translation.creator_id,
                error
              });
            }

            // Load target language
            try {
              const targetLang = await languageService.getLanguageById(
                translation.target_language_id
              );
              if (targetLang) {
                languagesMap[translation.target_language_id] = targetLang;
                debug('Successfully loaded target language:', {
                  languageId: translation.target_language_id,
                  language: targetLang
                });
              }
            } catch (error) {
              console.error('Failed to load target language:', {
                languageId: translation.target_language_id,
                error
              });
            }
          } catch (error) {
            console.error('Error processing translation:', {
              translationId: translation.id,
              error
            });
          }
        })
      );

      setTranslationVotes(votesMap);
      setTranslationCreators(creatorsMap);
      setTranslationLanguages(languagesMap);
    };

    loadTranslationData();
  }, [translations]);

  const renderTranslationCard = ({
    item: translation
  }: {
    item: Translation;
  }) => {
    const votes = translationVotes[translation.id] || [];
    const creator = translationCreators[translation.creator_id];
    const targetLanguage = translationLanguages[translation.target_language_id];
    const voteCount = calculateVoteCount(votes);
    debug('asset translation', {
      translationCreators,
      translationLanguages,
      votes,
      creator,
      targetLanguage,
      voteCount
    });
    return (
      <TouchableOpacity
        style={styles.translationCard}
        onPress={() => setSelectedTranslation(translation)}
      >
        <View style={styles.translationCardContent}>
          <View style={styles.translationCardLeft}>
            <Text style={styles.translationPreview} numberOfLines={2}>
              {getPreviewText(translation.text ?? '')}
            </Text>
            <Text style={styles.translatorInfo}>
              {currentUser && currentUser.id === translation.creator_id
                ? `${creator?.username} => `
                : ''}
              {targetLanguage?.native_name || targetLanguage?.english_name}
            </Text>
          </View>
          <View style={styles.translationCardRight}>
            <View style={styles.voteContainer}>
              <TouchableOpacity
                onPress={() => handleVote(translation.id, 'up')}
              >
                <Ionicons
                  name={getVoteIconName(translation.id, 'up')}
                  size={16}
                  color={colors.text}
                />
              </TouchableOpacity>
              <Text style={styles.voteCount}>{voteCount}</Text>
              <TouchableOpacity
                onPress={() => handleVote(translation.id, 'down')}
              >
                <Ionicons
                  name={getVoteIconName(translation.id, 'down')}
                  size={16}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
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
                  !assetContent.length && styles.disabledTab
                ]}
                onPress={() => setActiveTab('text')}
                disabled={!assetContent.length}
              >
                <Ionicons
                  name="text"
                  size={24}
                  color={
                    assetContent.length ? colors.text : colors.textSecondary
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
                {activeTab === 'text' && assetContent.length > 0 && (
                  <View style={styles.carouselWrapper}>
                    <Carousel
                      items={assetContent}
                      renderItem={(content) => {
                        return (
                          <View style={styles.sourceTextContainer}>
                            <View>
                              <Text style={styles.source_languageLabel}>
                                {sourceLanguage?.native_name ||
                                  sourceLanguage?.english_name}
                                :
                              </Text>
                              <Text style={styles.sourceText}>
                                {content.text}
                              </Text>
                            </View>

                            {content.audio_id &&
                            attachmentUris[content.audio_id]
                              ? // Audio player is rendered
                                (() => {
                                  return (
                                    <MiniAudioPlayer
                                      audioFile={{
                                        id: content.id,
                                        title: content.text,
                                        uri: attachmentUris[content.audio_id]
                                      }}
                                    />
                                  );
                                })()
                              : content.audio_id && loadingAttachments
                                ? // Showing loading indicator
                                  (() => {
                                    return (
                                      <View style={styles.audioLoading}>
                                        <Text
                                          style={{
                                            color: colors.textSecondary
                                          }}
                                        >
                                          Loading audio...
                                        </Text>
                                        <ActivityIndicator size="small" />
                                      </View>
                                    );
                                  })()
                                : // Not showing audio player or loading indicator
                                  (() => {
                                    console.log(
                                      `[AssetView] No audio player/loader for ${content.id}:`,
                                      {
                                        audioId: content.audio_id,
                                        hasUri: content.audio_id
                                          ? !!attachmentUris[content.audio_id]
                                          : false,
                                        loadingAttachments
                                      }
                                    );
                                    return null;
                                  })()}
                          </View>
                        );
                      }}
                    />
                  </View>
                )}
                {activeTab === 'image' && (
                  <ImageCarousel
                    uris={
                      asset?.images
                        ?.map((imageId) => attachmentUris[imageId])
                        .filter(Boolean) || []
                    }
                  />
                )}
              </View>
            )}

            <View style={styles.horizontalLine} />

            <View
              style={[
                styles.translationsContainer,
                { height: translationsContainerHeight }
              ]}
            >
              <View style={styles.translationHeader}>
                <View style={styles.alignmentContainer}>
                  <View style={styles.dropdownContainer}>
                    <CustomDropdown
                      label={t('sortBy')}
                      value={sortOption}
                      options={[
                        { label: t('votes'), value: 'voteCount' },
                        { label: t('date'), value: 'dateSubmitted' }
                      ]}
                      onSelect={(value) => setSortOption(value as SortOption)}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.newTranslationButton}
                    onPress={() => setIsNewTranslationModalVisible(true)}
                  >
                    <Ionicons name="add" size={24} color={colors.buttonText} />
                    <Text style={styles.newTranslationButtonText}>
                      {t('newTranslation')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <GestureHandlerRootView style={{ flex: 1 }}>
                <FlatList
                  data={translations.sort((a, b) => {
                    if (sortOption === 'voteCount') {
                      const votesA = translationVotes[a.id] || [];
                      const votesB = translationVotes[b.id] || [];
                      return (
                        calculateVoteCount(votesB) - calculateVoteCount(votesA)
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
            </View>
          </View>
        </SafeAreaView>

        {selectedTranslation && (
          <TranslationModal
            translation={selectedTranslation}
            onClose={() => setSelectedTranslation(null)}
            onVoteSubmitted={loadAssetAndTranslations}
          />
        )}

        <NewTranslationModal
          isVisible={isNewTranslationModalVisible}
          onClose={() => setIsNewTranslationModalVisible(false)}
          onSubmit={handleNewTranslation}
          asset_id={assetId!}
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
    flex: 1,
    paddingTop: spacing.medium // Add padding to the top
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
  translationsContainer: {
    // flex: 1,
  },
  translationsList: {
    padding: spacing.medium
  },
  translationHeader: {
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.medium
  },
  alignmentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  dropdownContainer: {
    flex: 1,
    marginRight: spacing.medium
  },
  newTranslationButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.medium,
    height: 50,
    borderRadius: borderRadius.medium
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
  flatListContent: {
    paddingRight: spacing.medium
  },
  carouselWrapper: {
    flex: 1,
    paddingHorizontal: spacing.medium
  }
});
