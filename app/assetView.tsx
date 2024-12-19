import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fontSizes, spacing, sharedStyles, borderRadius } from '@/styles/theme';
import { FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import { CustomDropdown } from '@/components/CustomDropdown';
import { formatRelativeDate } from '@/utils/dateUtils';
import { language } from '@/db/drizzleSchema';
import { userService, User } from '@/database_services/userService';
import { languageService } from '@/database_services/languageService';
import { assetService, Asset } from '@/database_services/assetService';
import { translationService, Translation } from '@/database_services/translationService';
import { voteService, Vote } from '@/database_services/voteService';
import { TranslationModal } from '@/components/TranslationModal';
import { NewTranslationModal } from '@/components/NewTranslationModal';
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
const { supabaseConnector } = system;
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

const ASSET_VIEWER_PROPORTION = 0.38;

type TabType = 'text' | 'audio' | 'image';
type SortOption = 'voteCount' | 'dateSubmitted';


export default function AssetView() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const { asset_id, assetName } = useLocalSearchParams<{ asset_id: string; assetName: string }>();
  const [asset, setAsset] = useState<Asset>();
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('voteCount');
  const [selectedTranslation, setSelectedTranslation] = useState<Translation | null>(null);
  const [isNewTranslationModalVisible, setIsNewTranslationModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceLanguage, setSourceLanguage] = useState<typeof language.$inferSelect | null>(null);
  const [translationVotes, setTranslationVotes] = useState<Record<string, Vote[]>>({});
  const [translationCreators, setTranslationCreators] = useState<Record<string, User>>({});
  const [translationLanguages, setTranslationLanguages] = useState<Record<string, typeof language.$inferSelect>>({});
  

  const screenHeight = Dimensions.get('window').height;
  const assetViewerHeight = screenHeight * ASSET_VIEWER_PROPORTION;
  const translationsContainerHeight = screenHeight - assetViewerHeight - 100;

  const calculateVoteCount = (votes: Vote[]): number => {
    return votes.reduce((acc, vote) => acc + (vote.polarity === 'up' ? 1 : -1), 0);
  };

  useEffect(() => {
    // Debug Supabase client configuration
    const channel = supabaseConnector.client.channel('debug');
    channel
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });
  
    return () => {
      supabaseConnector.client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    loadAssetAndTranslations();
  }, [asset_id]);

  useEffect(() => {
    if (!asset_id) return;
  
    // Subscribe to translations changes
    const translationsSubscription = supabaseConnector.client
      .channel('translations-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'translation',
          filter: `asset_id=eq.${asset_id}`,
        },
        async (payload: RealtimePostgresChangesPayload<{
          id: string;
          asset_id: string;
          text: string;
          target_language_id: string;
          creator_id: string;
        }>) => {
          console.log('Translation change received:', payload);
          const loadedTranslations = await translationService.getTranslationsByAssetId(asset_id);
          setTranslations(loadedTranslations);
          // Force reload of translation data
          await loadTranslationData();
        }
      )
      .subscribe((status) => {
        console.log('Translation subscription status:', status);
      });
  
    // Subscribe to votes changes
    const votesSubscription = supabaseConnector.client
      .channel('votes-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vote',
        },
        async (payload: RealtimePostgresChangesPayload<{
          id: string;
          translation_id: string;
          polarity: 'up' | 'down';
          comment?: string;
          creator_id: string;
        }>) => {
          console.log('Vote change received:', payload);
          const translationId = 
            (payload.new && 'translation_id' in payload.new ? payload.new.translation_id : undefined) ||
            (payload.old && 'translation_id' in payload.old ? payload.old.translation_id : undefined);
  
          if (translationId) {
            const votes = await voteService.getVotesByTranslationId(translationId);
            setTranslationVotes(prev => ({
              ...prev,
              [translationId]: votes
            }));
            // Force reload of translation data
            await loadTranslationData();
          }
        }
      )
      .subscribe((status) => {
        console.log('Votes subscription status:', status);
      });
  
    // Add a debug subscription to monitor all changes
    const debugSubscription = supabaseConnector.client
      .channel('debug-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
        },
        (payload) => {
          console.log('Debug: Database change detected:', payload);
        }
      )
      .subscribe();
  
    return () => {
      console.log('Cleaning up subscriptions');
      supabaseConnector.client.removeChannel(translationsSubscription);
      supabaseConnector.client.removeChannel(votesSubscription);
      supabaseConnector.client.removeChannel(debugSubscription);
    };
  }, [asset_id]);
  
  // Add a debug effect to monitor state changes
  useEffect(() => {
    console.log('Translations updated:', translations);
  }, [translations]);
  
  useEffect(() => {
    console.log('Translation votes updated:', translationVotes);
  }, [translationVotes]);

  const loadTranslationData = async () => {
    try {
      const votesMap: Record<string, Vote[]> = {};
      const creatorsMap: Record<string, User> = {};
      const languagesMap: Record<string, typeof language.$inferSelect> = {};
  
      await Promise.all(translations.map(async (translation) => {
        votesMap[translation.id] = await voteService.getVotesByTranslationId(translation.id);
        const creator = await userService.getUserById(translation.creator_id);
        if (creator) creatorsMap[translation.creator_id] = creator;
        const targetLang = await languageService.getLanguageById(translation.target_language_id);
        if (targetLang) languagesMap[translation.target_language_id] = targetLang;
      }));
  
      setTranslationVotes(votesMap);
      setTranslationCreators(creatorsMap);
      setTranslationLanguages(languagesMap);
    } catch (error) {
      console.error('Error loading translation data:', error);
    }
  };

  // useEffect(() => {
  //   const checkPowerSyncState = async () => {
  //     try {
  //       const status = await system.db.getStatus();
  //       console.log('PowerSync status:', status);
  //     } catch (error) {
  //       console.error('Error checking PowerSync status:', error);
  //     }
  //   };
  
  //   checkPowerSyncState();
  // }, []);

  const loadAssetAndTranslations = async () => {
    try {
      if (!asset_id) return;
      setIsLoading(true);
      
      const loadedAsset = await assetService.getAssetById(asset_id);
      if (!loadedAsset) {
        Alert.alert('Error', 'Asset not found');
        return;
      }

      setAsset(loadedAsset);
      
      // Load source language
      const source = await languageService.getLanguageById(loadedAsset.source_language_id);
      setSourceLanguage(source);

      // Load translations
      const loadedTranslations = await translationService.getTranslationsByAssetId(asset_id);
      setTranslations(loadedTranslations);
    } catch (error) {
      console.error('Error loading asset and translations:', error);
      Alert.alert('Error', 'Failed to load asset data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (translation_id: string, polarity: 'up' | 'down') => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to vote');
      return;
    }

    try {
      await voteService.addVote({
        translation_id,
        creator_id: currentUser.id,
        polarity,
      });
      await loadAssetAndTranslations(); // Reload to get updated vote counts
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to submit vote');
    }
  };

  const handleNewTranslation = async () => {
    try {
      await loadAssetAndTranslations();
    } catch (error) {
      console.error('Error creating translation:', error);
      Alert.alert('Error', 'Failed to create translation');
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

  const getVoteIconName = (translationId: string, voteType: 'up' | 'down'): VoteIconName => {
    if (!currentUser) return `thumbs-${voteType}-outline` as VoteIconName;
    
    const votes = translationVotes[translationId] || [];
    const userVote = votes.find(vote => vote.creator_id === currentUser.id);
  
    if (!userVote) return `thumbs-${voteType}-outline` as VoteIconName;
    return userVote.polarity === voteType 
      ? `thumbs-${voteType}` as VoteIconName 
      : `thumbs-${voteType}-outline` as VoteIconName;
  };

  useEffect(() => {
    const loadTranslationData = async () => {
      const votesMap: Record<string, Vote[]> = {};
      const creatorsMap: Record<string, User> = {};
      const languagesMap: Record<string, typeof language.$inferSelect> = {};
  
      await Promise.all(translations.map(async (translation) => {
        // Load votes
        votesMap[translation.id] = await voteService.getVotesByTranslationId(translation.id);
        
        // Load creator
        const creator = await userService.getUserById(translation.creator_id);
        if (creator) creatorsMap[translation.creator_id] = creator;
        
        // Load target language
        const targetLang = await languageService.getLanguageById(translation.target_language_id);
        if (targetLang) languagesMap[translation.target_language_id] = targetLang;
      }));
  
      setTranslationVotes(votesMap);
      setTranslationCreators(creatorsMap);
      setTranslationLanguages(languagesMap);
    };
  
    loadTranslationData();
  }, [translations]);

  const renderTranslationCard = ({ item: translation }: { item: Translation }) => {
    const votes = translationVotes[translation.id] || [];
    const creator = translationCreators[translation.creator_id];
    const targetLanguage = translationLanguages[translation.target_language_id];
    const voteCount = calculateVoteCount(votes);
  
    return (
      <TouchableOpacity
        style={styles.translationCard}
        onPress={() => setSelectedTranslation(translation)}
      >
        <View style={styles.translationCardContent}>
          <View style={styles.translationCardLeft}>
            <Text style={styles.translationPreview} numberOfLines={2}>
              {getPreviewText(translation.text)}
            </Text>
            <Text style={styles.translatorInfo}>
              by {creator?.username} in {targetLanguage?.native_name || targetLanguage?.english_name}
            </Text>
          </View>
          <View style={styles.translationCardRight}>
            <View style={styles.voteContainer}>
              <TouchableOpacity onPress={() => handleVote(translation.id, 'up')}>
                <Ionicons 
                  name={getVoteIconName(translation.id, 'up')} 
                  size={16} 
                  color={colors.text} 
                />
              </TouchableOpacity>
              <Text style={styles.voteCount}>{voteCount}</Text>
              <TouchableOpacity onPress={() => handleVote(translation.id, 'down')}>
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
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={{ flex: 1 }}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.content}>
            <Text style={styles.title}>{asset?.name}</Text>
            
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'text' && styles.activeTab]}
                onPress={() => setActiveTab('text')}
              >
                <Ionicons name="text" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'audio' && styles.activeTab]}
                onPress={() => setActiveTab('audio')}
              >
                <Ionicons name="volume-high" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'image' && styles.activeTab]}
                onPress={() => setActiveTab('image')}
              >
                <Ionicons name="image" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.assetViewer, { height: assetViewerHeight }]}>
              {activeTab === 'text' && (
                <View style={styles.sourceTextContainer}>
                  <Text style={styles.source_languageLabel}>
                    {sourceLanguage?.native_name || sourceLanguage?.english_name}:
                  </Text>
                  <Text style={styles.sourceText}>{asset?.text}</Text>
                </View>
              )}
              {/* {activeTab === 'audio' && <AudioPlayer audioFiles={asset?.audio || []} useCarousel={true} />}
              {activeTab === 'image' && <ImageCarousel images={asset?.images || []} />} */}
            </View>

            <View style={styles.horizontalLine} />

            <View style={[styles.translationsContainer, { height: translationsContainerHeight }]}>
              <View style={styles.translationHeader}>
                <View style={styles.alignmentContainer}>
                  <View style={styles.dropdownContainer}>
                    <CustomDropdown
                      label="Sort by"
                      value={sortOption}
                      options={[
                        { label: 'Votes', value: 'voteCount' },
                        { label: 'Date', value: 'dateSubmitted' }
                      ]}
                      onSelect={(value) => setSortOption(value as SortOption)}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.newTranslationButton}
                    onPress={() => setIsNewTranslationModalVisible(true)}
                  >
                    <Ionicons name="add" size={24} color={colors.buttonText} />
                    <Text style={styles.newTranslationButtonText}>New Translation</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <GestureHandlerRootView style={{ flex: 1 }}>
                <FlatList
                  data={translations.sort((a, b) => {
                    if (sortOption === 'voteCount') {
                      const votesA = translationVotes[a.id] || [];
                      const votesB = translationVotes[b.id] || [];
                      return calculateVoteCount(votesB) - calculateVoteCount(votesA);
                    }
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  })}
                  renderItem={renderTranslationCard}
                  keyExtractor={item => item.id}
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
        asset_id={asset_id!}
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
  source_languageLabel: {
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