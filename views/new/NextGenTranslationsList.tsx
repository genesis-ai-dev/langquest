import AudioPlayer from '@/components/AudioPlayer';
import { translation, vote } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { MembershipRole } from '@/hooks/useUserPermissions';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import NextGenTranslationModal from './NextGenTranslationModal';

interface NextGenTranslationsListProps {
  assetId: string;
  assetName?: string;
  refreshKey?: number;
  // Props passed from parent to avoid re-querying
  projectData?: {
    private: boolean;
    name?: string;
    id?: string;
  } | null;
  canVote?: boolean;
  membership?: MembershipRole;
}

interface TranslationWithVotes {
  id: string;
  text: string | null;
  target_language_id: string;
  creator_id: string;
  created_at: string;
  audio: string | null;
  upVotes: number;
  downVotes: number;
  netVotes: number;
  source?: string;
}

type SortOption = 'voteCount' | 'dateSubmitted';

function useNextGenOfflineTranslations(assetId: string, refreshKey?: number) {
  return useQuery({
    queryKey: ['translations', 'offline', assetId, refreshKey],
    queryFn: async () => {
      // Get translations for this asset
      const translations = await system.db
        .select()
        .from(translation)
        .where(eq(translation.asset_id, assetId));

      // Get votes for each translation
      const translationsWithVotes = await Promise.all(
        translations.map(async (trans) => {
          const votes = await system.db
            .select()
            .from(vote)
            .where(eq(vote.translation_id, trans.id));

          const upVotes = votes.filter(
            (v) => v.active && v.polarity === 'up'
          ).length;
          const downVotes = votes.filter(
            (v) => v.active && v.polarity === 'down'
          ).length;

          return {
            ...trans,
            upVotes,
            downVotes,
            netVotes: upVotes - downVotes,
            source: 'localSqlite'
          } as TranslationWithVotes;
        })
      );

      return translationsWithVotes;
    },
    enabled: !!assetId
  });
}

async function fetchCloudTranslations(
  assetId: string
): Promise<TranslationWithVotes[]> {
  // Get translations
  const { data: translationsData, error: translationsError } =
    await system.supabaseConnector.client
      .from('translation')
      .select('*')
      .eq('asset_id', assetId);

  if (translationsError) throw translationsError;
  // Supabase always returns an array, even if empty

  // Get votes for each translation
  const translationsWithVotes = await Promise.all(
    translationsData.map(async (trans: typeof translation.$inferSelect) => {
      const { data: votesData, error: votesError } =
        await system.supabaseConnector.client
          .from('vote')
          .select('*')
          .eq('translation_id', trans.id)
          .eq('active', true);

      if (votesError) {
        console.warn('Error fetching votes:', votesError);
        // Continue with empty votes instead of throwing
        return {
          ...trans,
          upVotes: 0,
          downVotes: 0,
          netVotes: 0,
          source: 'cloudSupabase'
        } as TranslationWithVotes;
      }

      // Supabase returns empty array, not null
      const votes = votesData as { polarity: string; active?: boolean }[];
      const upVotes = votes.filter((v) => v.polarity === 'up').length;
      const downVotes = votes.filter((v) => v.polarity === 'down').length;

      return {
        ...trans,
        upVotes,
        downVotes,
        netVotes: upVotes - downVotes,
        source: 'cloudSupabase'
      } as TranslationWithVotes;
    })
  );

  return translationsWithVotes;
}

export default function NextGenTranslationsList({
  assetId,
  refreshKey,
  projectData,
  canVote: canVoteProp,
  membership: membershipProp
}: NextGenTranslationsListProps) {
  const isOnline = useNetworkStatus();
  const [useOfflineData, setUseOfflineData] = useState(false);
  const [cloudTranslations, setCloudTranslations] = useState<
    TranslationWithVotes[]
  >([]);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<Error | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('voteCount');
  const [selectedTranslationId, setSelectedTranslationId] = useState<
    string | null
  >(null);
  const [voteRefreshKey, setVoteRefreshKey] = useState(0);

  const { data: offlineTranslations, isLoading: isOfflineLoading } =
    useNextGenOfflineTranslations(assetId, refreshKey || voteRefreshKey);

  // Use props from parent if available, otherwise default behavior
  const isPrivateProject = projectData?.private || false;
  const canVote = canVoteProp !== undefined ? canVoteProp : !isPrivateProject;
  const membership = membershipProp || null;

  // Collect audio IDs for attachment states
  const audioIds = React.useMemo(() => {
    const activeTranslations = useOfflineData
      ? offlineTranslations
      : cloudTranslations;
    if (!activeTranslations) return [];

    return activeTranslations
      .filter((trans) => trans.audio)
      .map((trans) => trans.audio!)
      .filter(Boolean);
  }, [useOfflineData, offlineTranslations, cloudTranslations]);

  const { attachmentStates, isLoading: _isLoadingAttachments } =
    useAttachmentStates(audioIds);

  // Load cloud translations when online and not using offline data
  useEffect(() => {
    if (!assetId || useOfflineData || !isOnline) {
      setCloudTranslations([]);
      setIsCloudLoading(false);
      setCloudError(null);
      return;
    }

    const loadCloudTranslations = async () => {
      try {
        setIsCloudLoading(true);
        setCloudError(null);
        const translations = await fetchCloudTranslations(assetId);
        setCloudTranslations(translations);
      } catch (error) {
        console.error('Error fetching cloud translations:', error);
        setCloudError(error as Error);
        setCloudTranslations([]);
      } finally {
        setIsCloudLoading(false);
      }
    };

    void loadCloudTranslations();
  }, [assetId, useOfflineData, isOnline, refreshKey, voteRefreshKey]);

  const activeTranslations = useOfflineData
    ? offlineTranslations
    : cloudTranslations;
  const isLoading = useOfflineData ? isOfflineLoading : isCloudLoading;

  const sortedTranslations = React.useMemo(() => {
    if (!activeTranslations) return [];
    return [...activeTranslations].sort((a, b) => {
      if (sortOption === 'voteCount') {
        return b.netVotes - a.netVotes;
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [activeTranslations, sortOption]);

  const getPreviewText = (fullText: string, maxLength = 50) => {
    if (!fullText) return '(Empty translation)';
    if (fullText.length <= maxLength) return fullText;
    return fullText.substring(0, maxLength).trim() + '...';
  };

  const getAudioUri = (translation: TranslationWithVotes) => {
    if (!translation.audio) return undefined;
    const localUri = attachmentStates.get(translation.audio)?.local_uri;
    return localUri
      ? system.permAttachmentQueue?.getLocalUri(localUri)
      : undefined;
  };

  const handleTranslationPress = (translationId: string) => {
    // Only allow opening modal if user can vote or if it's a public project
    if (canVote || !isPrivateProject) {
      setSelectedTranslationId(translationId);
    }
  };

  const handleVoteSuccess = () => {
    // Increment vote refresh key to trigger re-queries
    setVoteRefreshKey((prev) => prev + 1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.horizontalLine} />

      {/* Header with toggle and sort options */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.sectionTitle}>
            Translations
            {isPrivateProject && !canVote && (
              <Text style={styles.lockIndicator}> 🔒</Text>
            )}
          </Text>

          {/* Data Source Toggle */}
          <View style={styles.toggleContainer}>
            <Text
              style={[
                styles.toggleText,
                !useOfflineData && styles.inactiveToggleText
              ]}
            >
              💾
            </Text>
            <Switch
              value={!useOfflineData}
              onValueChange={(value) => setUseOfflineData(!value)}
              trackColor={{
                false: colors.inputBackground,
                true: colors.primary
              }}
              thumbColor={colors.buttonText}
              style={styles.switch}
            />
            <Text
              style={[
                styles.toggleText,
                useOfflineData && styles.inactiveToggleText
              ]}
            >
              🌐
            </Text>
          </View>
          {/* Sort options */}
          <View style={styles.sortContainer}>
            <TouchableOpacity
              style={[
                styles.sortButton,
                sortOption === 'voteCount' && styles.sortButtonSelected
              ]}
              onPress={() => setSortOption('voteCount')}
            >
              <Ionicons
                name="thumbs-up"
                size={16}
                color={
                  sortOption === 'voteCount' ? colors.background : colors.text
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sortButton,
                sortOption === 'dateSubmitted' && styles.sortButtonSelected
              ]}
              onPress={() => setSortOption('dateSubmitted')}
            >
              <Ionicons
                name="calendar"
                size={16}
                color={
                  sortOption === 'dateSubmitted'
                    ? colors.background
                    : colors.text
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Membership status for private projects */}
        {isPrivateProject && (
          <View style={styles.membershipStatus}>
            <Text style={styles.membershipText}>
              {membership === 'owner' && '👑 Owner'}
              {membership === 'member' && '👤 Member'}
              {!membership && '🚫 Non-member (View Only)'}
            </Text>
          </View>
        )}
      </View>

      {/* Translations List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loader}
          />
        ) : sortedTranslations.length > 0 ? (
          sortedTranslations.map((trans) => (
            <TouchableOpacity
              key={trans.id}
              style={[
                styles.translationCard,
                isPrivateProject && !canVote && styles.disabledCard
              ]}
              onPress={() => handleTranslationPress(trans.id)}
              disabled={isPrivateProject && !canVote}
            >
              <View style={styles.translationCardContent}>
                <View style={styles.translationCardLeft}>
                  <View style={styles.translationHeader}>
                    <Text style={styles.translationPreview} numberOfLines={2}>
                      {getPreviewText(trans.text || '')}
                    </Text>
                    {trans.audio && (
                      <Ionicons
                        name="volume-high"
                        size={16}
                        color={colors.primary}
                        style={styles.audioIcon}
                      />
                    )}
                  </View>

                  {/* Audio Player */}
                  {trans.audio && getAudioUri(trans) && (
                    <View style={styles.audioPlayerContainer}>
                      <AudioPlayer
                        audioUri={getAudioUri(trans)}
                        useCarousel={false}
                        mini={true}
                      />
                    </View>
                  )}

                  <Text style={styles.sourceTag}>
                    {trans.source === 'cloudSupabase'
                      ? '🌐 Cloud'
                      : '💾 Offline'}
                  </Text>
                </View>

                <View style={styles.translationCardRight}>
                  <View style={styles.voteContainer}>
                    <Ionicons
                      name="thumbs-up"
                      size={16}
                      color={colors.text}
                      style={{ opacity: trans.upVotes > 0 ? 1 : 0.3 }}
                    />
                    <Text style={styles.voteCount}>{trans.netVotes}</Text>
                    <Ionicons
                      name="thumbs-down"
                      size={16}
                      color={colors.text}
                      style={{ opacity: trans.downVotes > 0 ? 1 : 0.3 }}
                    />
                  </View>
                  <Text style={styles.netVoteText}>
                    {trans.upVotes} ↑ {trans.downVotes} ↓
                  </Text>
                </View>
              </View>

              {/* Lock overlay for private projects without access */}
              {isPrivateProject && !canVote && (
                <View style={styles.lockOverlay}>
                  <Ionicons
                    name="lock-closed"
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
              )}
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No translations yet. Be the first to translate!
            </Text>
          </View>
        )}

        {/* Offline/Cloud stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            {useOfflineData ? '💾 Offline' : '🌐 Cloud'} Data
            {cloudError && !useOfflineData && ' (Error loading cloud data)'}
          </Text>
        </View>
      </ScrollView>

      {/* Translation Modal */}
      {selectedTranslationId && (canVote || !isPrivateProject) && (
        <NextGenTranslationModal
          visible={!!selectedTranslationId}
          onClose={() => setSelectedTranslationId(null)}
          translationId={selectedTranslationId}
          onVoteSuccess={handleVoteSuccess}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  horizontalLine: {
    height: 1,
    backgroundColor: colors.inputBorder,
    marginVertical: spacing.medium
  },
  header: {
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.medium
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.small
  },
  sectionTitle: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text
  },
  lockIndicator: {
    fontSize: fontSizes.medium
  },
  membershipStatus: {
    marginTop: spacing.xsmall
  },
  membershipText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small
  },
  toggleText: {
    fontSize: fontSizes.medium
  },
  inactiveToggleText: {
    opacity: 0.3
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }]
  },
  sortContainer: {
    flexDirection: 'row',
    gap: spacing.small
  },
  sortButton: {
    padding: spacing.small,
    borderRadius: borderRadius.small,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  sortButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  scrollView: {
    flex: 1
  },
  scrollViewContent: {
    paddingHorizontal: spacing.medium,
    paddingBottom: spacing.medium
  },
  loader: {
    marginTop: spacing.xlarge
  },
  translationCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    position: 'relative'
  },
  disabledCard: {
    opacity: 0.7
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.medium
  },
  translationCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
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
    marginBottom: spacing.xsmall
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small
  },
  voteCount: {
    color: colors.text,
    fontSize: fontSizes.small,
    fontWeight: 'bold'
  },
  sourceTag: {
    fontSize: fontSizes.xsmall,
    color: colors.textSecondary
  },
  emptyContainer: {
    padding: spacing.xlarge,
    alignItems: 'center'
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSizes.medium,
    textAlign: 'center'
  },
  statsContainer: {
    padding: spacing.small,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center'
  },
  statsText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  netVoteText: {
    fontSize: fontSizes.xsmall,
    color: colors.textSecondary,
    marginTop: spacing.xsmall
  },
  translationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xsmall
  },
  audioIcon: {
    marginLeft: spacing.small,
    marginTop: 2
  },
  audioPlayerContainer: {
    marginVertical: spacing.small,
    backgroundColor: colors.background,
    borderRadius: borderRadius.small,
    padding: spacing.small
  }
});
