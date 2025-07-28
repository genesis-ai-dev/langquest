import AudioPlayer from '@/components/AudioPlayer';
import { translation, vote } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import type { MembershipRole } from '@/hooks/useUserPermissions';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq, inArray } from 'drizzle-orm';
import React, { useState } from 'react';
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
import { useHybridData } from './useHybridData';

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

// Base types from the database
type Translation = InferSelectModel<typeof translation>;
type Vote = InferSelectModel<typeof vote>;

// Extended type with vote information
interface TranslationWithVotes extends Translation {
  upVotes: number;
  downVotes: number;
  netVotes: number;
  source?: 'localSqlite' | 'cloudSupabase';
}

type SortOption = 'voteCount' | 'dateSubmitted';

export default function NextGenTranslationsList({
  assetId,
  refreshKey,
  projectData,
  canVote: canVoteProp,
  membership: membershipProp
}: NextGenTranslationsListProps) {
  const { t } = useLocalization();
  const [useOfflineData, setUseOfflineData] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('voteCount');
  const [selectedTranslationId, setSelectedTranslationId] = useState<
    string | null
  >(null);
  const [voteRefreshKey, setVoteRefreshKey] = useState(0);

  // First query: Get translations
  const {
    data: translations,
    isLoading: isTranslationsLoading,
    offlineError: translationsOfflineError,
    cloudError: translationsCloudError
  } = useHybridData<Translation>({
    dataType: 'translations',
    queryKeyParams: [assetId, refreshKey || 0, voteRefreshKey],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db
        .select()
        .from(translation)
        .where(eq(translation.asset_id, assetId))
    ),

    // Cloud query function
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('translation')
        .select('*')
        .eq('asset_id', assetId);

      if (error) throw error;
      return data as Translation[];
    },

    // Disable cloud query when user explicitly wants offline data
    enableCloudQuery: !useOfflineData
  });

  // Get translation IDs for vote query
  const translationIds = React.useMemo(() => {
    return translations.map((t) => t.id);
  }, [translations]);

  // Second query: Get votes for all translations
  const { data: votes, isLoading: isVotesLoading } = useHybridData<Vote>({
    dataType: 'votes',
    queryKeyParams: [...translationIds, voteRefreshKey],

    // PowerSync query for votes
    offlineQuery:
      translationIds.length > 0
        ? toCompilableQuery(
            system.db
              .select()
              .from(vote)
              .where(
                and(
                  inArray(vote.translation_id, translationIds),
                  eq(vote.active, true)
                )
              )
          )
        : 'SELECT * FROM vote WHERE 1=0', // Empty query when no translations

    // Cloud query for votes
    cloudQueryFn: async () => {
      if (translationIds.length === 0) return [];

      const { data, error } = await system.supabaseConnector.client
        .from('vote')
        .select('*')
        .in('translation_id', translationIds)
        .eq('active', true);

      if (error) throw error;
      return data as Vote[];
    },

    // Disable cloud query when user explicitly wants offline data
    enableCloudQuery: !useOfflineData
  });

  // Combine translations with vote counts
  const translationsWithVotes = React.useMemo(() => {
    // Group votes by translation ID
    const votesByTranslation = new Map<string, Vote[]>();
    votes.forEach((v) => {
      const existing = votesByTranslation.get(v.translation_id) || [];
      votesByTranslation.set(v.translation_id, [...existing, v]);
    });

    // Calculate vote counts for each translation
    return translations.map((trans) => {
      const translationVotes = votesByTranslation.get(trans.id) || [];
      const upVotes = translationVotes.filter(
        (v) => v.polarity === 'up'
      ).length;
      const downVotes = translationVotes.filter(
        (v) => v.polarity === 'down'
      ).length;

      return {
        ...trans,
        upVotes,
        downVotes,
        netVotes: upVotes - downVotes
      } as TranslationWithVotes;
    });
  }, [translations, votes]);

  // Use props from parent if available, otherwise default behavior
  const isPrivateProject = projectData?.private || false;
  const canVote = canVoteProp !== undefined ? canVoteProp : !isPrivateProject;
  const membership = membershipProp || null;

  // Collect audio IDs for attachment states
  const audioIds = React.useMemo(() => {
    return translationsWithVotes
      .filter((trans: any) => trans.audio_segments?.length > 0)
      .flatMap((trans: any) =>
        trans.audio_segments!.map((segment: any) => segment.audio_url)
      )
      .filter(Boolean);
  }, [translationsWithVotes]);

  const { attachmentStates, isLoading: _isLoadingAttachments } =
    useAttachmentStates(audioIds);

  const sortedTranslations = React.useMemo(() => {
    return [...translationsWithVotes].sort((a, b) => {
      if (sortOption === 'voteCount') {
        return b.netVotes - a.netVotes;
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [translationsWithVotes, sortOption]);

  const getPreviewText = (fullText: string, maxLength = 50) => {
    if (!fullText) return '(Empty translation)';
    if (fullText.length <= maxLength) return fullText;
    return fullText.substring(0, maxLength).trim() + '...';
  };

  const getAudioUri = (translation: any) => {
    if (!translation.audio_segments?.length) return undefined;
    const firstSegment = translation.audio_segments[0];
    const localUri = attachmentStates.get(firstSegment.audio_url)?.local_uri;
    return localUri
      ? system.permAttachmentQueue?.getLocalUri(localUri)
      : undefined;
  };

  const handleTranslationPress = (translationId: string) => {
    // Always allow opening modal - voting restrictions are handled inside the modal
    setSelectedTranslationId(translationId);
  };

  const handleVoteSuccess = () => {
    // Increment vote refresh key to trigger re-queries
    setVoteRefreshKey((prev) => prev + 1);
  };

  const isLoading = isTranslationsLoading || isVotesLoading;
  const hasError = useOfflineData
    ? translationsOfflineError
    : translationsCloudError;

  return (
    <View style={styles.container}>
      <View style={styles.horizontalLine} />

      {/* Header with toggle and sort options */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.sectionTitle}>
            {t('translations')}
            {isPrivateProject && !canVote && (
              <Text style={styles.lockIndicator}> 🔒</Text>
            )}
          </Text>

          {/* Data Source Toggle */}
          {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
          {SHOW_DEV_ELEMENTS && (
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
          )}
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
        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
        {SHOW_DEV_ELEMENTS && isPrivateProject && (
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
              style={styles.translationCard}
              onPress={() => handleTranslationPress(trans.id)}
            >
              <View style={styles.translationCardContent}>
                <View style={styles.translationCardLeft}>
                  <View style={styles.translationHeader}>
                    <Text style={styles.translationPreview} numberOfLines={2}>
                      {getPreviewText(trans.text || '')}
                    </Text>
                    {(trans as any).audio_segments?.length > 0 && (
                      <View style={styles.audioIndicator}>
                        <Ionicons
                          name="volume-high"
                          size={16}
                          color={colors.primary}
                          style={styles.audioIcon}
                        />
                        {(trans as any).audio_segments.length > 1 && (
                          <Text style={styles.segmentCount}>
                            {(trans as any).audio_segments.length}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Audio Player - show first segment */}
                  {(trans as any).audio_segments?.length > 0 &&
                    getAudioUri(trans) && (
                      <View style={styles.audioPlayerContainer}>
                        <AudioPlayer
                          audioUri={getAudioUri(trans)}
                          useCarousel={false}
                          mini={true}
                        />
                        {(trans as any).audio_segments.length > 1 && (
                          <Text style={styles.multiSegmentNote}>
                            +{(trans as any).audio_segments.length - 1} more
                            segments
                          </Text>
                        )}
                      </View>
                    )}

                  {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
                  {SHOW_DEV_ELEMENTS && (
                    <Text style={styles.sourceTag}>
                      {trans.source === 'cloudSupabase'
                        ? '🌐 Cloud'
                        : '💾 Offline'}
                    </Text>
                  )}
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
                  {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
                  {SHOW_DEV_ELEMENTS && (
                    <Text style={styles.netVoteText}>
                      {trans.upVotes} ↑ {trans.downVotes} ↓
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('noTranslationsYet')}</Text>
          </View>
        )}

        {/* Offline/Cloud stats with error handling */}
        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
        {SHOW_DEV_ELEMENTS && (
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              {useOfflineData ? '💾 Offline' : '🌐 Cloud'} Data
              {hasError &&
                ` (Error loading ${useOfflineData ? 'offline' : 'cloud'} data)`}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Translation Modal */}
      {selectedTranslationId && (
        <NextGenTranslationModal
          visible={!!selectedTranslationId}
          onClose={() => setSelectedTranslationId(null)}
          translationId={selectedTranslationId}
          onVoteSuccess={handleVoteSuccess}
          canVote={canVote}
          isPrivateProject={isPrivateProject}
          projectId={projectData?.id}
          projectName={projectData?.name}
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
  audioIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.small,
    marginTop: 2
  },
  segmentCount: {
    fontSize: fontSizes.xsmall,
    color: colors.textSecondary,
    marginLeft: spacing.xsmall
  },
  multiSegmentNote: {
    fontSize: fontSizes.xsmall,
    color: colors.textSecondary,
    marginTop: spacing.xsmall
  },
  audioPlayerContainer: {
    marginVertical: spacing.small,
    backgroundColor: colors.background,
    borderRadius: borderRadius.small,
    padding: spacing.small
  }
});
