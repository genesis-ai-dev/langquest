import { translation, vote } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
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

interface NextGenTranslationsListProps {
  assetId: string;
  assetName?: string;
  refreshKey?: number;
}

interface TranslationWithVotes {
  id: string;
  text: string | null;
  target_language_id: string;
  creator_id: string;
  created_at: string;
  upVotes: number;
  downVotes: number;
  netVotes: number;
  source?: string;
}

type SortOption = 'voteCount' | 'dateSubmitted';

function useNextGenOfflineTranslations(assetId: string) {
  return useQuery({
    queryKey: ['translations', 'offline', assetId],
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
  if (!translationsData) return [];

  // Get votes for each translation
  const translationsWithVotes = await Promise.all(
    translationsData.map(async (trans) => {
      const { data: votesData, error: votesError } =
        await system.supabaseConnector.client
          .from('vote')
          .select('*')
          .eq('translation_id', trans.id)
          .eq('active', true);

      if (votesError) throw votesError;

      const votes = votesData || [];
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
  refreshKey
}: NextGenTranslationsListProps) {
  const isOnline = useNetworkStatus();
  const [useOfflineData, setUseOfflineData] = useState(true);
  const [cloudTranslations, setCloudTranslations] = useState<
    TranslationWithVotes[]
  >([]);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<Error | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('voteCount');

  const { data: offlineTranslations, isLoading: isOfflineLoading } =
    useNextGenOfflineTranslations(assetId);

  // Fetch cloud translations when online
  useEffect(() => {
    if (!assetId) return;

    const fetchCloud = async () => {
      if (!isOnline) {
        console.log('📱 [TRANSLATIONS LIST] Skipping cloud query - offline');
        setCloudTranslations([]);
        setIsCloudLoading(false);
        return;
      }

      try {
        setIsCloudLoading(true);
        setCloudError(null);
        console.log('🌐 [TRANSLATIONS LIST] Fetching cloud translations');
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

    void fetchCloud();
  }, [assetId, isOnline, refreshKey]);

  const activeTranslations = useOfflineData
    ? offlineTranslations
    : cloudTranslations;
  const isLoading = useOfflineData ? isOfflineLoading : isCloudLoading;

  // Sort translations
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

  return (
    <View style={styles.container}>
      <View style={styles.horizontalLine} />

      {/* Header with toggle and sort options */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.sectionTitle}>Translations</Text>

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
                sortOption === 'dateSubmitted' ? colors.background : colors.text
              }
            />
          </TouchableOpacity>
        </View>
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
            <View key={trans.id} style={styles.translationCard}>
              <View style={styles.translationCardContent}>
                <View style={styles.translationCardLeft}>
                  <Text style={styles.translationPreview} numberOfLines={2}>
                    {getPreviewText(trans.text || '')}
                  </Text>
                  <Text style={styles.sourceTag}>
                    {trans.source === 'cloudSupabase'
                      ? '🌐 Cloud'
                      : '💾 Offline'}
                  </Text>
                </View>
                <View style={styles.translationCardRight}>
                  <View style={styles.voteContainer}>
                    <Ionicons
                      name="thumbs-up-outline"
                      size={16}
                      color={colors.text}
                    />
                    <Text style={styles.voteCount}>{trans.upVotes}</Text>
                    <Ionicons
                      name="thumbs-down-outline"
                      size={16}
                      color={colors.text}
                    />
                    <Text style={styles.voteCount}>{trans.downVotes}</Text>
                  </View>
                  <Text style={styles.netVoteText}>
                    Net: {trans.netVotes > 0 ? '+' : ''}
                    {trans.netVotes}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {cloudError && !useOfflineData
                ? `Error: ${cloudError.message}`
                : 'No translations available'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Total: {sortedTranslations.length} | Offline:{' '}
          {offlineTranslations?.length ?? 0} | Cloud:{' '}
          {isOnline ? cloudTranslations.length : 'N/A'}
        </Text>
      </View>
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
    marginBottom: spacing.medium
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
  }
});
