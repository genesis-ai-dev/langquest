import { system } from '@/db/powersync/system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';

interface CategoryProgress {
  count: number;
  isLoading: boolean;
  hasError: boolean;
}

interface DiscoveredIds {
  questIds: string[];
  projectIds: string[];
  questAssetLinkIds: string[];
  assetIds: string[];
  assetContentLinkIds: string[];
  voteIds: string[];
  questTagLinkIds: string[];
  assetTagLinkIds: string[];
  tagIds: string[];
  languageIds: string[];
  languoidIds: string[];
  languoidAliasIds: string[];
  languoidSourceIds: string[];
  languoidPropertyIds: string[];
  languoidRegionIds: string[];
  regionIds: string[];
  regionAliasIds: string[];
  regionSourceIds: string[];
  regionPropertyIds: string[];
}

export interface DiscoveryState {
  isDiscovering: boolean;
  progressSharedValues: {
    quest: ReturnType<typeof useSharedValue<CategoryProgress>>;
    project: ReturnType<typeof useSharedValue<CategoryProgress>>;
    questAssetLinks: ReturnType<typeof useSharedValue<CategoryProgress>>;
    assets: ReturnType<typeof useSharedValue<CategoryProgress>>;
    assetContentLinks: ReturnType<typeof useSharedValue<CategoryProgress>>;
    votes: ReturnType<typeof useSharedValue<CategoryProgress>>;
    questTagLinks: ReturnType<typeof useSharedValue<CategoryProgress>>;
    assetTagLinks: ReturnType<typeof useSharedValue<CategoryProgress>>;
    tags: ReturnType<typeof useSharedValue<CategoryProgress>>;
    languages: ReturnType<typeof useSharedValue<CategoryProgress>>;
  };
  totalRecordsShared: ReturnType<typeof useSharedValue<number>>;
  discoveredIds: DiscoveredIds;
  hasError: boolean;
  cancel: () => void;
  startDiscovery: () => void;
}

const initialProgress: CategoryProgress = {
  count: 0,
  isLoading: false,
  hasError: false
};

/**
 * Hook to discover all related records for a quest before downloading.
 * Queries cloud database recursively and updates UI in real-time using Reanimated shared values.
 */
export function useQuestDownloadDiscovery(questId: string): DiscoveryState {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [discoveredIds, setDiscoveredIds] = useState<DiscoveredIds>({
    questIds: [],
    projectIds: [],
    questAssetLinkIds: [],
    assetIds: [],
    assetContentLinkIds: [],
    voteIds: [],
    questTagLinkIds: [],
    assetTagLinkIds: [],
    tagIds: [],
    languageIds: [],
    languoidIds: [],
    languoidAliasIds: [],
    languoidSourceIds: [],
    languoidPropertyIds: [],
    languoidRegionIds: [],
    regionIds: [],
    regionAliasIds: [],
    regionSourceIds: [],
    regionPropertyIds: []
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Create shared values for smooth UI updates without React re-renders
  const questProgress = useSharedValue<CategoryProgress>(initialProgress);
  const projectProgress = useSharedValue<CategoryProgress>(initialProgress);
  const questAssetLinksProgress =
    useSharedValue<CategoryProgress>(initialProgress);
  const assetsProgress = useSharedValue<CategoryProgress>(initialProgress);
  const assetContentLinksProgress =
    useSharedValue<CategoryProgress>(initialProgress);
  const votesProgress = useSharedValue<CategoryProgress>(initialProgress);
  const questTagLinksProgress =
    useSharedValue<CategoryProgress>(initialProgress);
  const assetTagLinksProgress =
    useSharedValue<CategoryProgress>(initialProgress);
  const tagsProgress = useSharedValue<CategoryProgress>(initialProgress);
  const languagesProgress = useSharedValue<CategoryProgress>(initialProgress);
  const totalRecordsShared = useSharedValue<number>(0);

  const updateTotal = useCallback(() => {
    'worklet';
    totalRecordsShared.value =
      questProgress.value.count +
      projectProgress.value.count +
      questAssetLinksProgress.value.count +
      assetsProgress.value.count +
      assetContentLinksProgress.value.count +
      votesProgress.value.count +
      questTagLinksProgress.value.count +
      assetTagLinksProgress.value.count +
      tagsProgress.value.count +
      languagesProgress.value.count;
  }, [
    questProgress,
    projectProgress,
    questAssetLinksProgress,
    assetsProgress,
    assetContentLinksProgress,
    votesProgress,
    questTagLinksProgress,
    assetTagLinksProgress,
    tagsProgress,
    languagesProgress,
    totalRecordsShared
  ]);

  const startDiscovery = useCallback(async () => {
    if (!questId || isDiscovering) return;

    console.log(`🔍 [Discovery] Starting discovery for quest: ${questId}`);
    setIsDiscovering(true);
    setHasError(false);

    // Reset all progress
    questProgress.value = { ...initialProgress, isLoading: true };
    projectProgress.value = { ...initialProgress, isLoading: true };
    questAssetLinksProgress.value = { ...initialProgress, isLoading: true };
    assetsProgress.value = { ...initialProgress, isLoading: true };
    assetContentLinksProgress.value = { ...initialProgress, isLoading: true };
    votesProgress.value = { ...initialProgress, isLoading: true };
    questTagLinksProgress.value = { ...initialProgress, isLoading: true };
    assetTagLinksProgress.value = { ...initialProgress, isLoading: true };
    tagsProgress.value = { ...initialProgress, isLoading: true };
    languagesProgress.value = { ...initialProgress, isLoading: true };
    totalRecordsShared.value = 0;

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    const ids: DiscoveredIds = {
      questIds: [],
      projectIds: [],
      questAssetLinkIds: [],
      assetIds: [],
      assetContentLinkIds: [],
      voteIds: [],
      questTagLinkIds: [],
      assetTagLinkIds: [],
      tagIds: [],
      languageIds: [],
      languoidIds: [],
      languoidAliasIds: [],
      languoidSourceIds: [],
      languoidPropertyIds: [],
      languoidRegionIds: [],
      regionIds: [],
      regionAliasIds: [],
      regionSourceIds: [],
      regionPropertyIds: []
    };

    try {
      // Wave 1: Independent queries (quest, project, quest-asset links, quest-tag links)
      const [questResult, questAssetLinksResult, questTagLinksResult] =
        await Promise.all([
          // Query quest and its project
          (async () => {
            try {
              if (signal.aborted) return null;
              const { data, error } = await system.supabaseConnector.client
                .from('quest')
                .select('id, project_id')
                .eq('id', questId)
                .eq('active', true)
                .single();

              if (error) {
                // Check if quest exists locally but not in cloud
                console.error(
                  '🔍 [Discovery] Quest not found in cloud, checking local database...'
                );
                throw new Error(
                  `Quest ${questId} not found in cloud database. It may only exist locally or you may not have permission to access it.`
                );
              }
              if (signal.aborted) return null;

              ids.questIds = [data.id];
              ids.projectIds = [data.project_id];

              questProgress.value = {
                count: 1,
                isLoading: false,
                hasError: false
              };
              projectProgress.value = {
                count: 1,
                isLoading: false,
                hasError: false
              };
              updateTotal();

              console.log(
                `🔍 [Discovery] Quest & Project found: ${data.id}, ${data.project_id}`
              );
              return data;
            } catch (error) {
              console.error('🔍 [Discovery] Error fetching quest:', error);
              questProgress.value = {
                count: 0,
                isLoading: false,
                hasError: true
              };
              projectProgress.value = {
                count: 0,
                isLoading: false,
                hasError: true
              };
              setHasError(true);
              return null;
            }
          })(),

          // Query quest-asset links
          (async () => {
            try {
              if (signal.aborted) return null;
              const { data, error } = await system.supabaseConnector.client
                .from('quest_asset_link')
                .select('quest_id, asset_id')
                .eq('quest_id', questId)
                .eq('active', true);

              if (error) throw error;
              if (signal.aborted) return null;

              // Store composite keys as "quest_id|asset_id"
              ids.questAssetLinkIds = data.map(
                (link) => `${link.quest_id}|${link.asset_id}`
              );
              questAssetLinksProgress.value = {
                count: data.length,
                isLoading: false,
                hasError: false
              };
              updateTotal();

              console.log(
                `🔍 [Discovery] Quest-asset links found: ${data.length}`
              );
              return data;
            } catch (error) {
              console.error(
                '🔍 [Discovery] Error fetching quest-asset links:',
                error
              );
              questAssetLinksProgress.value = {
                count: 0,
                isLoading: false,
                hasError: true
              };
              setHasError(true);
              return null;
            }
          })(),

          // Query quest-tag links
          (async () => {
            try {
              if (signal.aborted) return null;
              const { data, error } = await system.supabaseConnector.client
                .from('quest_tag_link')
                .select('quest_id, tag_id')
                .eq('quest_id', questId)
                .eq('active', true);

              if (error) throw error;
              if (signal.aborted) return null;

              // Store composite keys as "quest_id|tag_id"
              ids.questTagLinkIds = data.map(
                (link) => `${link.quest_id}|${link.tag_id}`
              );
              questTagLinksProgress.value = {
                count: data.length,
                isLoading: false,
                hasError: false
              };
              updateTotal();

              console.log(
                `🔍 [Discovery] Quest-tag links found: ${data.length}`
              );
              return data;
            } catch (error) {
              console.error(
                '🔍 [Discovery] Error fetching quest-tag links:',
                error
              );
              questTagLinksProgress.value = {
                count: 0,
                isLoading: false,
                hasError: true
              };
              setHasError(true);
              return null;
            }
          })()
        ]);

      if (signal.aborted) {
        console.log('🔍 [Discovery] Aborted after wave 1');
        setIsDiscovering(false);
        return;
      }

      // Get asset IDs from links
      const assetIds =
        questAssetLinksResult?.map((link) => link.asset_id) || [];
      ids.assetIds = assetIds;

      // Wave 2: Asset-dependent queries
      if (assetIds.length > 0) {
        const [assetsResult, assetContentLinksResult, assetTagLinksResult] =
          await Promise.all([
            // Query assets
            (async () => {
              try {
                if (signal.aborted) return null;
                const { data, error } = await system.supabaseConnector.client
                  .from('asset')
                  .select('id, source_language_id')
                  .in('id', assetIds)
                  .eq('active', true);

                if (error) throw error;
                if (signal.aborted) return null;

                assetsProgress.value = {
                  count: data.length,
                  isLoading: false,
                  hasError: false
                };
                updateTotal();

                console.log(`🔍 [Discovery] Assets found: ${data.length}`);
                return data;
              } catch (error) {
                console.error('🔍 [Discovery] Error fetching assets:', error);
                assetsProgress.value = {
                  count: 0,
                  isLoading: false,
                  hasError: true
                };
                setHasError(true);
                return null;
              }
            })(),

            // Query asset-content links
            (async () => {
              try {
                if (signal.aborted) return null;
                const { data, error } = await system.supabaseConnector.client
                  .from('asset_content_link')
                  .select('id, source_language_id')
                  .in('asset_id', assetIds)
                  .eq('active', true);

                if (error) throw error;
                if (signal.aborted) return null;

                ids.assetContentLinkIds = data.map((link) => link.id);
                assetContentLinksProgress.value = {
                  count: data.length,
                  isLoading: false,
                  hasError: false
                };
                updateTotal();

                console.log(
                  `🔍 [Discovery] Asset-content links found: ${data.length}`
                );
                return data;
              } catch (error) {
                console.error(
                  '🔍 [Discovery] Error fetching asset-content links:',
                  error
                );
                assetContentLinksProgress.value = {
                  count: 0,
                  isLoading: false,
                  hasError: true
                };
                setHasError(true);
                return null;
              }
            })(),

            // Query asset-tag links
            (async () => {
              try {
                if (signal.aborted) return null;
                const { data, error } = await system.supabaseConnector.client
                  .from('asset_tag_link')
                  .select('asset_id, tag_id')
                  .in('asset_id', assetIds)
                  .eq('active', true);

                if (error) throw error;
                if (signal.aborted) return null;

                // Store composite keys as "asset_id|tag_id"
                ids.assetTagLinkIds = data.map(
                  (link) => `${link.asset_id}|${link.tag_id}`
                );
                assetTagLinksProgress.value = {
                  count: data.length,
                  isLoading: false,
                  hasError: false
                };
                updateTotal();

                console.log(
                  `🔍 [Discovery] Asset-tag links found: ${data.length}`
                );
                return data;
              } catch (error) {
                console.error(
                  '🔍 [Discovery] Error fetching asset-tag links:',
                  error
                );
                assetTagLinksProgress.value = {
                  count: 0,
                  isLoading: false,
                  hasError: true
                };
                setHasError(true);
                return null;
              }
            })()
          ]);

        if (signal.aborted) {
          console.log('🔍 [Discovery] Aborted after wave 2');
          setIsDiscovering(false);
          return;
        }

        // Collect language IDs from assets, translations, and project
        const languageIds = new Set<string>();
        if (questResult?.project_id) {
          // Get project languages
          try {
            const { data: projectData, error } =
              await system.supabaseConnector.client
                .from('project')
                .select('source_language_id, target_language_id')
                .eq('id', questResult.project_id)
                .single();

            if (!error && projectData) {
              if (projectData.source_language_id)
                languageIds.add(projectData.source_language_id);
              if (projectData.target_language_id)
                languageIds.add(projectData.target_language_id);
            }
          } catch (error) {
            console.error(
              '🔍 [Discovery] Error fetching project languages:',
              error
            );
          }
        }

        assetsResult?.forEach((asset) => {
          if (asset.source_language_id)
            languageIds.add(asset.source_language_id);
        });
        assetContentLinksResult?.forEach((link) => {
          if (link.source_language_id) languageIds.add(link.source_language_id);
        });

        ids.languageIds = Array.from(languageIds);
        languagesProgress.value = {
          count: ids.languageIds.length,
          isLoading: false,
          hasError: false
        };

        // Discover languoid IDs from project_language_link and asset_content_link
        const languoidIds = new Set<string>();
        try {
          if (signal.aborted) return;

          // Get languoid IDs from project_language_link
          if (ids.projectIds.length > 0) {
            const { data: projectLanguageLinks, error: pllError } =
              await system.supabaseConnector.client
                .from('project_language_link')
                .select('languoid_id')
                .in('project_id', ids.projectIds)
                .not('languoid_id', 'is', null)
                .eq('active', true);

            if (!pllError && projectLanguageLinks) {
              projectLanguageLinks.forEach((link) => {
                if (link.languoid_id) languoidIds.add(link.languoid_id);
              });
            }
          }

          // Get languoid IDs from asset_content_link
          if (ids.assetContentLinkIds.length > 0) {
            const { data: assetContentLinks, error: aclError } =
              await system.supabaseConnector.client
                .from('asset_content_link')
                .select('languoid_id')
                .in('id', ids.assetContentLinkIds)
                .not('languoid_id', 'is', null)
                .eq('active', true);

            if (!aclError && assetContentLinks) {
              assetContentLinks.forEach((link) => {
                if (link.languoid_id) languoidIds.add(link.languoid_id);
              });
            }
          }

          ids.languoidIds = Array.from(languoidIds);

          // If we found languoids, discover related records
          if (ids.languoidIds.length > 0) {
            // Get languoid aliases, sources, properties, and region links
            const [
              { data: languoidAliases },
              { data: languoidSources },
              { data: languoidProperties },
              { data: languoidRegions }
            ] = await Promise.all([
              system.supabaseConnector.client
                .from('languoid_alias')
                .select('id')
                .in('subject_languoid_id', ids.languoidIds)
                .eq('active', true),
              system.supabaseConnector.client
                .from('languoid_source')
                .select('id')
                .in('languoid_id', ids.languoidIds)
                .eq('active', true),
              system.supabaseConnector.client
                .from('languoid_property')
                .select('id')
                .in('languoid_id', ids.languoidIds)
                .eq('active', true),
              system.supabaseConnector.client
                .from('languoid_region')
                .select('id, region_id')
                .in('languoid_id', ids.languoidIds)
                .eq('active', true)
            ]);

            if (languoidAliases) {
              ids.languoidAliasIds = languoidAliases.map((a) => a.id);
            }
            if (languoidSources) {
              ids.languoidSourceIds = languoidSources.map((s) => s.id);
            }
            if (languoidProperties) {
              ids.languoidPropertyIds = languoidProperties.map((p) => p.id);
            }

            // Get region IDs from languoid_region links
            const regionIds = new Set<string>();
            if (languoidRegions) {
              ids.languoidRegionIds = languoidRegions.map((lr) => lr.id);
              languoidRegions.forEach((lr) => {
                if (lr.region_id) regionIds.add(lr.region_id);
              });
            }

            ids.regionIds = Array.from(regionIds);

            // If we found regions, discover related records
            if (ids.regionIds.length > 0) {
              const [
                { data: regionAliases },
                { data: regionSources },
                { data: regionProperties }
              ] = await Promise.all([
                system.supabaseConnector.client
                  .from('region_alias')
                  .select('id')
                  .in('subject_region_id', ids.regionIds)
                  .eq('active', true),
                system.supabaseConnector.client
                  .from('region_source')
                  .select('id')
                  .in('region_id', ids.regionIds)
                  .eq('active', true),
                system.supabaseConnector.client
                  .from('region_property')
                  .select('id')
                  .in('region_id', ids.regionIds)
                  .eq('active', true)
              ]);

              if (regionAliases) {
                ids.regionAliasIds = regionAliases.map((a) => a.id);
              }
              if (regionSources) {
                ids.regionSourceIds = regionSources.map((s) => s.id);
              }
              if (regionProperties) {
                ids.regionPropertyIds = regionProperties.map((p) => p.id);
              }
            }
          }

          console.log(
            `🔍 [Discovery] Languoids found: ${ids.languoidIds.length}, Regions: ${ids.regionIds.length}`
          );
        } catch (error) {
          console.error('🔍 [Discovery] Error discovering languoids:', error);
          // Don't fail the whole discovery if languoid discovery fails
        }

        // Wave 3: Vote and tag queries
        const [votesResult, tagsResult] = await Promise.all([
          // Query votes
          (async () => {
            try {
              if (signal.aborted) return null;
              const { data, error } = await system.supabaseConnector.client
                .from('vote')
                .select('id')
                .in('asset_id', assetIds)
                .eq('active', true);

              if (error) throw error;
              if (signal.aborted) return null;

              ids.voteIds = data.map((v) => v.id);
              votesProgress.value = {
                count: data.length,
                isLoading: false,
                hasError: false
              };
              updateTotal();

              console.log(`🔍 [Discovery] Votes found: ${data.length}`);
              return data;
            } catch (error) {
              console.error('🔍 [Discovery] Error fetching votes:', error);
              votesProgress.value = {
                count: 0,
                isLoading: false,
                hasError: true
              };
              setHasError(true);
              return null;
            }
          })(),

          // Query tags (unique from both quest-tag and asset-tag links)
          (async () => {
            try {
              if (signal.aborted) return null;
              const allTagIds = [
                ...(questTagLinksResult?.map((link) => link.tag_id) || []),
                ...(assetTagLinksResult?.map((link) => link.tag_id) || [])
              ];
              const uniqueTagIds = Array.from(new Set(allTagIds));

              if (uniqueTagIds.length === 0) {
                tagsProgress.value = {
                  count: 0,
                  isLoading: false,
                  hasError: false
                };
                updateTotal();
                return [];
              }

              const { data, error } = await system.supabaseConnector.client
                .from('tag')
                .select('id')
                .in('id', uniqueTagIds)
                .eq('active', true);

              if (error) throw error;
              if (signal.aborted) return null;

              ids.tagIds = data.map((tag) => tag.id);
              tagsProgress.value = {
                count: data.length,
                isLoading: false,
                hasError: false
              };
              updateTotal();

              console.log(`🔍 [Discovery] Tags found: ${data.length}`);
              return data;
            } catch (error) {
              console.error('🔍 [Discovery] Error fetching tags:', error);
              tagsProgress.value = {
                count: 0,
                isLoading: false,
                hasError: true
              };
              setHasError(true);
              return null;
            }
          })()
        ]);
      } else {
        // No assets, set everything to 0
        assetsProgress.value = { count: 0, isLoading: false, hasError: false };
        assetContentLinksProgress.value = {
          count: 0,
          isLoading: false,
          hasError: false
        };
        votesProgress.value = { count: 0, isLoading: false, hasError: false };
        assetTagLinksProgress.value = {
          count: 0,
          isLoading: false,
          hasError: false
        };
        tagsProgress.value = { count: 0, isLoading: false, hasError: false };
        languagesProgress.value = {
          count: 0,
          isLoading: false,
          hasError: false
        };
      }

      updateTotal();
      setDiscoveredIds(ids);
      console.log(
        `🔍 [Discovery] Complete! Total records: ${totalRecordsShared.value}`
      );
    } catch (error) {
      console.error('🔍 [Discovery] Unexpected error:', error);
      setHasError(true);
    } finally {
      setIsDiscovering(false);
      abortControllerRef.current = null;
    }
  }, [
    questId,
    isDiscovering,
    questProgress,
    projectProgress,
    questAssetLinksProgress,
    assetsProgress,
    assetContentLinksProgress,
    votesProgress,
    questTagLinksProgress,
    assetTagLinksProgress,
    tagsProgress,
    languagesProgress,
    totalRecordsShared,
    updateTotal
  ]);

  const cancel = useCallback(() => {
    console.log('🔍 [Discovery] Cancelling discovery');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsDiscovering(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    isDiscovering,
    progressSharedValues: {
      quest: questProgress,
      project: projectProgress,
      questAssetLinks: questAssetLinksProgress,
      assets: assetsProgress,
      assetContentLinks: assetContentLinksProgress,
      votes: votesProgress,
      questTagLinks: questTagLinksProgress,
      assetTagLinks: assetTagLinksProgress,
      tags: tagsProgress,
      languages: languagesProgress
    },
    totalRecordsShared,
    discoveredIds,
    hasError,
    cancel,
    startDiscovery
  };
}
