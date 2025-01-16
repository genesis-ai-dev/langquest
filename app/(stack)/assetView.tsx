import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  colors,
  fontSizes,
  spacing,
  sharedStyles,
  borderRadius,
} from '@/styles/theme';
import { FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import { CustomDropdown } from '@/components/CustomDropdown';
import { formatRelativeDate } from '@/utils/dateUtils';
import {
  assetService,
  AssetWithRelations,
} from '@/database_services/assetService';
import {
  translationService,
  TranslationWithRelations,
} from '@/database_services/translationService';
import { voteService } from '@/database_services/voteService';
import { TranslationModal } from '@/components/TranslationModal';
import { NewTranslationModal } from '@/components/NewTranslationModal';
import { useAuth } from '@/contexts/AuthContext';
import AudioPlayer from '@/components/AudioPlayer';
import ImageCarousel from '@/components/ImageCarousel';
import Carousel from '@/components/Carousel';
import { useTranslation } from '@/hooks/useTranslation';

const ASSET_VIEWER_PROPORTION = 0.38;

const getFirstAvailableTab = (asset: AssetWithRelations | null): TabType => {
  if (!asset) return 'text';
  if (asset.text) return 'text';
  if (asset.audio?.length) return 'audio';
  if (asset.images?.length) return 'image';
  return 'text'; // fallback
};

type TabType = 'text' | 'audio' | 'image';
type SortOption = 'voteCount' | 'dateSubmitted';

export default function AssetView() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const { assetId, assetName } = useLocalSearchParams<{
    assetId: string;
    assetName: string;
  }>();
  const [asset, setAsset] = useState<AssetWithRelations | null>(null);
  const [translations, setTranslations] = useState<TranslationWithRelations[]>(
    [],
  );
  const [sortOption, setSortOption] = useState<SortOption>('voteCount');
  const [selectedTranslation, setSelectedTranslation] =
    useState<TranslationWithRelations | null>(null);
  const [isNewTranslationModalVisible, setIsNewTranslationModalVisible] =
    useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const screenHeight = Dimensions.get('window').height;
  const assetViewerHeight = screenHeight * ASSET_VIEWER_PROPORTION;
  const translationsContainerHeight = screenHeight - assetViewerHeight - 100;

  useEffect(() => {
    loadAssetAndTranslations();
  }, [assetId]);

  useEffect(() => {
    if (asset) {
      setActiveTab(getFirstAvailableTab(asset));
    }
  }, [asset]);

  const loadAssetAndTranslations = async () => {
    try {
      if (!assetId) return;
      const loadedAsset = await assetService.getAssetById(assetId);
      if (loadedAsset) {
        setAsset(loadedAsset);
        const loadedTranslations =
          await translationService.getTranslationsByAssetId(assetId);
        setTranslations(loadedTranslations);
      }
    } catch (error) {
      console.error('Error loading asset and translations:', error);
      Alert.alert('Error', t('failedLoadAsset'));
    }
  };

  const handleVote = async (translationId: string, polarity: 'up' | 'down') => {
    if (!currentUser) {
      Alert.alert('Error', t('logInToVote'));
      return;
    }

    try {
      await voteService.addVote({
        translationId,
        creatorId: currentUser.id,
        polarity,
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
    translation: TranslationWithRelations,
    voteType: 'up' | 'down',
  ): VoteIconName => {
    if (!currentUser) return `thumbs-${voteType}-outline` as VoteIconName;

    const userVote = translation.votes.find(
      (vote) => vote.creatorId === currentUser.id,
    );

    if (!userVote) return `thumbs-${voteType}-outline` as VoteIconName;
    return userVote.polarity === voteType
      ? (`thumbs-${voteType}` as VoteIconName)
      : (`thumbs-${voteType}-outline` as VoteIconName);
  };

  const renderTranslationCard = ({
    item,
  }: {
    item: TranslationWithRelations;
  }) => (
    <TouchableOpacity
      style={styles.translationCard}
      onPress={() => setSelectedTranslation(item)}
    >
      <View style={styles.translationCardContent}>
        <View style={styles.translationCardLeft}>
          <Text style={styles.translationPreview} numberOfLines={2}>
            {getPreviewText(item.text)}
          </Text>
          <Text style={styles.translatorInfo}>
            by {item.creator.username} in{' '}
            {item.targetLanguage.nativeName || item.targetLanguage.englishName}
          </Text>
        </View>
        <View style={styles.translationCardRight}>
          <View style={styles.voteContainer}>
            <TouchableOpacity onPress={() => handleVote(item.id, 'up')}>
              <Ionicons
                name={getVoteIconName(item, 'up')}
                size={16}
                color={colors.text}
              />
            </TouchableOpacity>
            <Text style={styles.voteCount}>{item.voteCount}</Text>
            <TouchableOpacity onPress={() => handleVote(item.id, 'down')}>
              <Ionicons
                name={getVoteIconName(item, 'down')}
                size={16}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={styles.cardFooter}>
        {/* <Text style={styles.dateSubmitted}>{formatRelativeDate(item.createdAt)}</Text>
        {item.audio?.length > 0 && (
          <Ionicons name="volume-medium" size={20} color={colors.text} style={styles.audioIndicator} />
        )} */}
      </View>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.content}>
            <Text style={styles.title}>{asset?.name}</Text>
            <TouchableOpacity
              onPress={() => router.back()}
              style={sharedStyles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'text' && styles.activeTab,
                  !asset?.text && styles.disabledTab,
                ]}
                onPress={() => asset?.text && setActiveTab('text')}
                disabled={!asset?.text}
              >
                <Ionicons
                  name="text"
                  size={24}
                  color={asset?.text ? colors.text : colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'audio' && styles.activeTab,
                  !asset?.audio?.length && styles.disabledTab,
                ]}
                onPress={() => asset?.audio?.length && setActiveTab('audio')}
                disabled={!asset?.audio?.length}
              >
                <Ionicons
                  name="volume-high"
                  size={24}
                  color={
                    asset?.audio?.length ? colors.text : colors.textSecondary
                  }
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'image' && styles.activeTab,
                  !asset?.images?.length && styles.disabledTab,
                ]}
                onPress={() => asset?.images?.length && setActiveTab('image')}
                disabled={!asset?.images?.length}
              >
                <Ionicons
                  name="image"
                  size={24}
                  color={
                    asset?.images?.length ? colors.text : colors.textSecondary
                  }
                />
              </TouchableOpacity>
            </View>

            <View style={[styles.assetViewer, { height: assetViewerHeight }]}>
              {activeTab === 'text' && (
                <View style={styles.sourceTextContainer}>
                  <Text style={styles.sourceLanguageLabel}>
                    {asset?.sourceLanguage.nativeName ||
                      asset?.sourceLanguage.englishName}
                    :
                  </Text>
                  <Text style={styles.sourceText}>{asset?.text}</Text>
                </View>
              )}
              {activeTab === 'audio' &&
                asset?.audio &&
                Array.isArray(asset.audio) && (
                  <AudioPlayer
                    audioFiles={asset.audio.map((moduleId, index) => ({
                      id: `audio-${index}`,
                      title: `${t('audio')} ${index + 1}`,
                      moduleId: moduleId,
                    }))}
                  />
                )}
              {activeTab === 'image' &&
                asset?.images &&
                Array.isArray(asset.images) && (
                  <ImageCarousel imageModuleIds={asset.images} />
                )}
            </View>

            <View style={styles.horizontalLine} />

            <View
              style={[
                styles.translationsContainer,
                { height: translationsContainerHeight },
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
                        { label: t('date'), value: 'dateSubmitted' },
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
                  data={translations.sort((a, b) =>
                    sortOption === 'voteCount'
                      ? b.voteCount - a.voteCount
                      : new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                  )}
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
          assetId={assetId!}
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
    padding: spacing.medium,
  },
  safeArea: {
    flex: 1,
  },
  title: {
    fontSize: fontSizes.large,
    color: colors.text,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: spacing.small,
  },
  disabledTab: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    paddingTop: spacing.medium, // Add padding to the top
  },
  sourceTextContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginHorizontal: spacing.medium,
    marginBottom: spacing.medium,
  },
  sourceLanguageLabel: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: 'bold',
    marginBottom: spacing.small,
  },
  sourceText: {
    fontSize: fontSizes.medium,
    color: colors.text,
  },
  assetViewer: {
    flex: 1,
    // maxHeight: Dimensions.get('window').height * 0.4, // Adjust this value as needed
  },
  horizontalLine: {
    height: 1,
    backgroundColor: colors.inputBorder,
    marginVertical: spacing.medium,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
    marginBottom: spacing.medium,
  },
  tab: {
    padding: spacing.medium,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  translationsContainer: {
    // flex: 1,
  },
  translationsList: {
    padding: spacing.medium,
  },
  translationHeader: {
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.medium,
  },
  alignmentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dropdownContainer: {
    flex: 1,
    marginRight: spacing.medium,
  },
  newTranslationButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.medium,
    height: 50,
    borderRadius: borderRadius.medium,
  },
  newTranslationButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginLeft: spacing.small,
  },
  translationCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium,
  },
  translationCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  translationCardLeft: {
    flex: 1,
    marginRight: spacing.small,
  },
  translationCardRight: {
    alignItems: 'flex-end',
  },
  translationPreview: {
    color: colors.text,
    fontSize: fontSizes.medium,
    marginBottom: spacing.small,
  },
  translatorInfo: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    marginBottom: spacing.xsmall,
  },
  dateSubmitted: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  voteCount: {
    color: colors.text,
    fontSize: fontSizes.small,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.small,
  },
  audioIndicator: {
    // marginTop: spacing.medium,
  },
});
