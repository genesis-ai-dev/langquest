import { system } from '@/db/powersync/system';
import { countQuestPendingChanges } from '@/utils/questPendingChanges';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';

interface CategoryVerificationStatus {
  count: number;
  verified: number;
  isVerifying: boolean;
  hasError: boolean;
}

export interface VerifiedIds {
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
  attachmentIds: string[];
}

export interface VerificationState {
  isVerifying: boolean;
  /**
   * The quest has no `published_at`. Drafts are never offloadable: their
   * rows are creator-deletable on the server, so an offload would be a hard
   * delete instead of a local cleanup.
   */
  isDraft: boolean;
  hasPendingUploads: boolean;
  pendingUploadCount: number;
  progressSharedValues: {
    quest: ReturnType<typeof useSharedValue<CategoryVerificationStatus>>;
    project: ReturnType<typeof useSharedValue<CategoryVerificationStatus>>;
    questAssetLinks: ReturnType<
      typeof useSharedValue<CategoryVerificationStatus>
    >;
    assets: ReturnType<typeof useSharedValue<CategoryVerificationStatus>>;
    assetContentLinks: ReturnType<
      typeof useSharedValue<CategoryVerificationStatus>
    >;
    votes: ReturnType<typeof useSharedValue<CategoryVerificationStatus>>;
    questTagLinks: ReturnType<
      typeof useSharedValue<CategoryVerificationStatus>
    >;
    assetTagLinks: ReturnType<
      typeof useSharedValue<CategoryVerificationStatus>
    >;
    tags: ReturnType<typeof useSharedValue<CategoryVerificationStatus>>;
    languages: ReturnType<typeof useSharedValue<CategoryVerificationStatus>>;
    attachments: ReturnType<typeof useSharedValue<CategoryVerificationStatus>>;
  };
  totalRecordsShared: ReturnType<typeof useSharedValue<number>>;
  verifiedIds: VerifiedIds;
  hasError: boolean;
  cancel: () => void;
  startVerification: () => void;
}

const initialStatus: CategoryVerificationStatus = {
  count: 0,
  verified: 0,
  isVerifying: false,
  hasError: false
};

/**
 * Hook to verify all related records for a quest exist in the cloud before offloading.
 *
 * Phases:
 *   0. Refuse drafts (`published_at` null).
 *   1. Quest-scoped pending check: ps_crud ops for this quest's rows and
 *      unconfirmed audio files on this device for this quest.
 *   2. Cloud row counts for every category, compared with local counts.
 *   3. Audio: every `audio[]` value must sit on an acl row the server has
 *      stamped `audio_uploaded_at`. No per-file Storage listing.
 *
 * Ryder: Future incremental offload - Could add a `categories` parameter to only verify
 * specific record types (e.g., just audio files, keep translations). Would need category-specific
 * verification and deletion logic.
 */
export function useQuestOffloadVerification(
  questId: string
): VerificationState {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [hasPendingUploads, setHasPendingUploads] = useState(false);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [verifiedIds, setVerifiedIds] = useState<VerifiedIds>({
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
    regionPropertyIds: [],
    attachmentIds: []
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Create shared values for smooth UI updates
  const questProgress =
    useSharedValue<CategoryVerificationStatus>(initialStatus);
  const projectProgress =
    useSharedValue<CategoryVerificationStatus>(initialStatus);
  const questAssetLinksProgress =
    useSharedValue<CategoryVerificationStatus>(initialStatus);
  const assetsProgress =
    useSharedValue<CategoryVerificationStatus>(initialStatus);
  const assetContentLinksProgress =
    useSharedValue<CategoryVerificationStatus>(initialStatus);
  const votesProgress =
    useSharedValue<CategoryVerificationStatus>(initialStatus);
  const questTagLinksProgress =
    useSharedValue<CategoryVerificationStatus>(initialStatus);
  const assetTagLinksProgress =
    useSharedValue<CategoryVerificationStatus>(initialStatus);
  const tagsProgress =
    useSharedValue<CategoryVerificationStatus>(initialStatus);
  const languagesProgress =
    useSharedValue<CategoryVerificationStatus>(initialStatus);
  const attachmentsProgress =
    useSharedValue<CategoryVerificationStatus>(initialStatus);
  const totalRecordsShared = useSharedValue<number>(0);

  const updateTotal = useCallback(() => {
    'worklet';
    totalRecordsShared.value =
      questProgress.value.verified +
      projectProgress.value.verified +
      questAssetLinksProgress.value.verified +
      assetsProgress.value.verified +
      assetContentLinksProgress.value.verified +
      votesProgress.value.verified +
      questTagLinksProgress.value.verified +
      assetTagLinksProgress.value.verified +
      tagsProgress.value.verified +
      languagesProgress.value.verified +
      attachmentsProgress.value.verified;
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
    attachmentsProgress,
    totalRecordsShared
  ]);

  const startVerification = useCallback(async () => {
    if (!questId || isVerifying) return;

    console.log(
      `🔍 [Offload Verification] Starting verification for quest: ${questId}`
    );
    setIsVerifying(true);
    setIsDraft(false);
    setHasError(false);
    setHasPendingUploads(false);
    setPendingUploadCount(0);

    // Reset all progress
    questProgress.value = { ...initialStatus, isVerifying: true };
    projectProgress.value = { ...initialStatus, isVerifying: true };
    questAssetLinksProgress.value = { ...initialStatus, isVerifying: true };
    assetsProgress.value = { ...initialStatus, isVerifying: true };
    assetContentLinksProgress.value = { ...initialStatus, isVerifying: true };
    votesProgress.value = { ...initialStatus, isVerifying: true };
    questTagLinksProgress.value = { ...initialStatus, isVerifying: true };
    assetTagLinksProgress.value = { ...initialStatus, isVerifying: true };
    tagsProgress.value = { ...initialStatus, isVerifying: true };
    languagesProgress.value = { ...initialStatus, isVerifying: true };
    attachmentsProgress.value = { ...initialStatus, isVerifying: true };
    totalRecordsShared.value = 0;

    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    const ids: VerifiedIds = {
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
      // Languoid IDs are intentionally left empty during offload verification
      // Languoids are shared resources and shouldn't be undownloaded with individual quests
      languoidIds: [],
      languoidAliasIds: [],
      languoidSourceIds: [],
      languoidPropertyIds: [],
      languoidRegionIds: [],
      regionIds: [],
      regionAliasIds: [],
      regionSourceIds: [],
      regionPropertyIds: [],
      attachmentIds: []
    };

    try {
      // ============================================================================
      // PHASE 0: Drafts are never offloadable
      // ============================================================================
      const localQuestData = await system.db.query.quest.findFirst({
        where: (quest, { eq }) => eq(quest.id, questId),
        columns: { id: true, published_at: true }
      });

      if (!localQuestData) {
        throw new Error(`Quest ${questId} not found locally`);
      }

      if (localQuestData.published_at == null) {
        console.warn(
          `🔍 [Offload Verification] Quest ${questId} is a draft; refusing to offload`
        );
        setIsDraft(true);
        setIsVerifying(false);
        return;
      }

      // ============================================================================
      // PHASE 1: Check for pending uploads (scoped to this quest)
      // ============================================================================
      console.log(
        '🔍 [Offload Verification] Phase 1: Checking for pending uploads'
      );

      const pending = await countQuestPendingChanges(questId);
      const totalPending = pending.records + pending.audioFiles;

      if (totalPending > 0) {
        console.warn(
          `🔍 [Offload Verification] Found ${totalPending} pending uploads for this quest (${pending.records} DB records, ${pending.audioFiles} audio files)`
        );
        setHasPendingUploads(true);
        setPendingUploadCount(totalPending);
        setIsVerifying(false);
        return;
      }

      console.log('✅ [Offload Verification] No pending uploads found');

      // ============================================================================
      // PHASE 2: Verify database records in cloud (wave-based)
      // ============================================================================
      console.log(
        '🔍 [Offload Verification] Phase 2: Verifying database records'
      );

      // Wave 1: Quest, project, quest-asset links, quest-tag links
      const [questResult, questAssetLinksResult, questTagLinksResult] =
        await Promise.all([
          // Verify quest
          (async () => {
            try {
              if (signal.aborted) return null;

              questProgress.value = {
                count: 1,
                verified: 0,
                isVerifying: true,
                hasError: false
              };

              const { data, error } = await system.supabaseConnector.client
                .from('quest')
                .select('id, project_id')
                .eq('id', questId)
                .single();

              if (error || !data) {
                console.error(
                  '🔍 [Offload Verification] Quest not found in cloud:',
                  error
                );
                questProgress.value = {
                  count: 1,
                  verified: 0,
                  isVerifying: false,
                  hasError: true
                };
                setHasError(true);
                return null;
              }

              ids.questIds = [data.id];
              ids.projectIds = [data.project_id];

              questProgress.value = {
                count: 1,
                verified: 1,
                isVerifying: false,
                hasError: false
              };
              projectProgress.value = {
                count: 1,
                verified: 1,
                isVerifying: false,
                hasError: false
              };
              updateTotal();

              console.log(
                `✅ [Offload Verification] Quest verified in cloud: ${data.id}`
              );
              return data;
            } catch (error) {
              console.error(
                '🔍 [Offload Verification] Error verifying quest:',
                error
              );
              questProgress.value = {
                count: 1,
                verified: 0,
                isVerifying: false,
                hasError: true
              };
              projectProgress.value = {
                count: 1,
                verified: 0,
                isVerifying: false,
                hasError: true
              };
              setHasError(true);
              return null;
            }
          })(),

          // Verify quest-asset links
          (async () => {
            try {
              if (signal.aborted) return null;

              const localLinks =
                await system.db.query.quest_asset_link.findMany({
                  where: (link, { eq }) => eq(link.quest_id, questId)
                });

              const linkCount = localLinks.length;
              questAssetLinksProgress.value = {
                count: linkCount,
                verified: 0,
                isVerifying: true,
                hasError: false
              };

              if (linkCount === 0) {
                questAssetLinksProgress.value = {
                  count: 0,
                  verified: 0,
                  isVerifying: false,
                  hasError: false
                };
                return [];
              }

              const { data, error } = await system.supabaseConnector.client
                .from('quest_asset_link')
                .select('quest_id, asset_id')
                .eq('quest_id', questId);

              if (error) throw error;
              if (signal.aborted) return null;

              ids.questAssetLinkIds = data.map(
                (link) => `${link.quest_id}|${link.asset_id}`
              );
              questAssetLinksProgress.value = {
                count: linkCount,
                verified: data.length,
                isVerifying: false,
                hasError: data.length !== linkCount
              };

              if (data.length !== linkCount) {
                setHasError(true);
                console.warn(
                  `🔍 [Offload Verification] Quest-asset link mismatch: local=${linkCount}, cloud=${data.length}`
                );
              }

              updateTotal();
              console.log(
                `✅ [Offload Verification] Quest-asset links verified: ${data.length}/${linkCount}`
              );
              return data;
            } catch (error) {
              console.error(
                '🔍 [Offload Verification] Error verifying quest-asset links:',
                error
              );
              questAssetLinksProgress.value = {
                count: questAssetLinksProgress.value.count,
                verified: 0,
                isVerifying: false,
                hasError: true
              };
              setHasError(true);
              return null;
            }
          })(),

          // Verify quest-tag links
          (async () => {
            try {
              if (signal.aborted) return null;

              const localLinks = await system.db.query.quest_tag_link.findMany({
                where: (link, { eq }) => eq(link.quest_id, questId)
              });

              const linkCount = localLinks.length;
              questTagLinksProgress.value = {
                count: linkCount,
                verified: 0,
                isVerifying: true,
                hasError: false
              };

              if (linkCount === 0) {
                questTagLinksProgress.value = {
                  count: 0,
                  verified: 0,
                  isVerifying: false,
                  hasError: false
                };
                return [];
              }

              const { data, error } = await system.supabaseConnector.client
                .from('quest_tag_link')
                .select('quest_id, tag_id')
                .eq('quest_id', questId);

              if (error) throw error;
              if (signal.aborted) return null;

              ids.questTagLinkIds = data.map(
                (link) => `${link.quest_id}|${link.tag_id}`
              );
              questTagLinksProgress.value = {
                count: linkCount,
                verified: data.length,
                isVerifying: false,
                hasError: data.length !== linkCount
              };

              if (data.length !== linkCount) {
                setHasError(true);
                console.warn(
                  `🔍 [Offload Verification] Quest-tag link mismatch: local=${linkCount}, cloud=${data.length}`
                );
              }

              updateTotal();
              console.log(
                `✅ [Offload Verification] Quest-tag links verified: ${data.length}/${linkCount}`
              );
              return data;
            } catch (error) {
              console.error(
                '🔍 [Offload Verification] Error verifying quest-tag links:',
                error
              );
              questTagLinksProgress.value = {
                count: questTagLinksProgress.value.count,
                verified: 0,
                isVerifying: false,
                hasError: true
              };
              setHasError(true);
              return null;
            }
          })()
        ]);

      if (signal.aborted) {
        console.log('🔍 [Offload Verification] Aborted after wave 1');
        setIsVerifying(false);
        return;
      }

      // Get asset IDs from verified links
      const assetIds =
        questAssetLinksResult?.map((link) => link.asset_id) || [];
      ids.assetIds = assetIds;

      // Wave 2: Asset-dependent queries
      if (assetIds.length > 0) {
        const [assetsResult, assetContentLinksResult, assetTagLinksResult] =
          await Promise.all([
            // Verify assets
            (async () => {
              try {
                if (signal.aborted) return null;

                const localAssets = await system.db.query.asset.findMany({
                  where: (asset, { inArray }) => inArray(asset.id, assetIds)
                });

                const assetCount = localAssets.length;
                assetsProgress.value = {
                  count: assetCount,
                  verified: 0,
                  isVerifying: true,
                  hasError: false
                };

                const { data, error } = await system.supabaseConnector.client
                  .from('asset')
                  .select('id, source_language_id')
                  .in('id', assetIds)
                  .overrideTypes<
                    { id: string; source_language_id: string }[]
                  >();

                if (error) throw error;

                assetsProgress.value = {
                  count: assetCount,
                  verified: data.length,
                  isVerifying: false,
                  hasError: data.length !== assetCount
                };

                if (data.length !== assetCount) {
                  setHasError(true);
                  console.warn(
                    `🔍 [Offload Verification] Asset mismatch: local=${assetCount}, cloud=${data.length}`
                  );
                }

                updateTotal();
                console.log(
                  `✅ [Offload Verification] Assets verified: ${data.length}/${assetCount}`
                );
                return data;
              } catch (error) {
                console.error(
                  '🔍 [Offload Verification] Error verifying assets:',
                  error
                );
                assetsProgress.value = {
                  count: assetsProgress.value.count,
                  verified: 0,
                  isVerifying: false,
                  hasError: true
                };
                setHasError(true);
                return null;
              }
            })(),

            // Verify asset-content links
            (async () => {
              try {
                if (signal.aborted) return null;

                const localLinks =
                  await system.db.query.asset_content_link.findMany({
                    columns: {
                      id: true,
                      source_language_id: true,
                      audio: true
                    },
                    where: (link, { inArray }) =>
                      inArray(link.asset_id, assetIds)
                  });

                const linkCount = localLinks.length;
                assetContentLinksProgress.value = {
                  count: linkCount,
                  verified: 0,
                  isVerifying: true,
                  hasError: false
                };

                if (linkCount === 0) {
                  assetContentLinksProgress.value = {
                    count: 0,
                    verified: 0,
                    isVerifying: false,
                    hasError: false
                  };
                  return [];
                }

                const { data, error } = await system.supabaseConnector.client
                  .from('asset_content_link')
                  .select('id, source_language_id, audio, audio_uploaded_at')
                  .in('asset_id', assetIds)
                  .overrideTypes<
                    {
                      id: string;
                      source_language_id: string;
                      audio: string[] | null;
                      audio_uploaded_at: string | null;
                    }[]
                  >();

                if (error) throw error;

                ids.assetContentLinkIds = data.map((link) => link.id);
                assetContentLinksProgress.value = {
                  count: linkCount,
                  verified: data.length,
                  isVerifying: false,
                  hasError: data.length !== linkCount
                };

                if (data.length !== linkCount) {
                  setHasError(true);
                  console.warn(
                    `🔍 [Offload Verification] Asset-content link mismatch: local=${linkCount}, cloud=${data.length}`
                  );
                }

                updateTotal();
                console.log(
                  `✅ [Offload Verification] Asset-content links verified: ${data.length}/${linkCount}`
                );
                return data;
              } catch (error) {
                console.error(
                  '🔍 [Offload Verification] Error verifying asset-content links:',
                  error
                );
                assetContentLinksProgress.value = {
                  count: assetContentLinksProgress.value.count,
                  verified: 0,
                  isVerifying: false,
                  hasError: true
                };
                setHasError(true);
                return null;
              }
            })(),

            // Verify asset-tag links
            (async () => {
              try {
                if (signal.aborted) return null;

                const localLinks =
                  await system.db.query.asset_tag_link.findMany({
                    where: (link, { inArray }) =>
                      inArray(link.asset_id, assetIds)
                  });

                const linkCount = localLinks.length;
                assetTagLinksProgress.value = {
                  count: linkCount,
                  verified: 0,
                  isVerifying: true,
                  hasError: false
                };

                if (linkCount === 0) {
                  assetTagLinksProgress.value = {
                    count: 0,
                    verified: 0,
                    isVerifying: false,
                    hasError: false
                  };
                  return [];
                }

                const { data, error } = await system.supabaseConnector.client
                  .from('asset_tag_link')
                  .select('asset_id, tag_id')
                  .in('asset_id', assetIds);

                if (error) throw error;

                ids.assetTagLinkIds = data.map(
                  (link) => `${link.asset_id}|${link.tag_id}`
                );
                assetTagLinksProgress.value = {
                  count: linkCount,
                  verified: data.length,
                  isVerifying: false,
                  hasError: data.length !== linkCount
                };

                if (data.length !== linkCount) {
                  setHasError(true);
                  console.warn(
                    `🔍 [Offload Verification] Asset-tag link mismatch: local=${linkCount}, cloud=${data.length}`
                  );
                }

                updateTotal();
                console.log(
                  `✅ [Offload Verification] Asset-tag links verified: ${data.length}/${linkCount}`
                );
                return data;
              } catch (error) {
                console.error(
                  '🔍 [Offload Verification] Error verifying asset-tag links:',
                  error
                );
                assetTagLinksProgress.value = {
                  count: assetTagLinksProgress.value.count,
                  verified: 0,
                  isVerifying: false,
                  hasError: true
                };
                setHasError(true);
                return null;
              }
            })()
          ]);

        if (signal.aborted) {
          console.log('🔍 [Offload Verification] Aborted after wave 2');
          setIsVerifying(false);
          return;
        }

        // Collect language IDs
        const languageIds = new Set<string>();
        if (questResult?.project_id) {
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
              '🔍 [Offload Verification] Error fetching project languages:',
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
          verified: ids.languageIds.length,
          isVerifying: false,
          hasError: false
        };

        // Wave 3: Votes and tags
        const [votesResult, tagsResult] = await Promise.all([
          // Verify votes
          (async () => {
            try {
              if (signal.aborted) return null;

              const localVotes = await system.db.query.vote.findMany({
                where: (vote, { inArray }) => inArray(vote.asset_id, assetIds)
              });

              const voteCount = localVotes.length;
              votesProgress.value = {
                count: voteCount,
                verified: 0,
                isVerifying: true,
                hasError: false
              };

              if (voteCount === 0) {
                votesProgress.value = {
                  count: 0,
                  verified: 0,
                  isVerifying: false,
                  hasError: false
                };
                return [];
              }

              const { data, error } = await system.supabaseConnector.client
                .from('vote')
                .select('id')
                .in('asset_id', assetIds);

              if (error) throw error;
              if (signal.aborted) return null;

              ids.voteIds = data.map((v) => v.id);
              votesProgress.value = {
                count: voteCount,
                verified: data.length,
                isVerifying: false,
                hasError: data.length !== voteCount
              };

              if (data.length !== voteCount) {
                setHasError(true);
                console.warn(
                  `🔍 [Offload Verification] Vote mismatch: local=${voteCount}, cloud=${data.length}`
                );
              }

              updateTotal();
              console.log(
                `✅ [Offload Verification] Votes verified: ${data.length}/${voteCount}`
              );
              return data;
            } catch (error) {
              console.error(
                '🔍 [Offload Verification] Error verifying votes:',
                error
              );
              votesProgress.value = {
                count: votesProgress.value.count,
                verified: 0,
                isVerifying: false,
                hasError: true
              };
              setHasError(true);
              return null;
            }
          })(),

          // Verify tags
          (async () => {
            try {
              if (signal.aborted) return null;

              const allTagIds = [
                ...(questTagLinksResult?.map((link) => link.tag_id) || []),
                ...(assetTagLinksResult?.map((link) => link.tag_id) || [])
              ];
              const uniqueTagIds = Array.from(new Set(allTagIds));

              const tagCount = uniqueTagIds.length;
              tagsProgress.value = {
                count: tagCount,
                verified: 0,
                isVerifying: true,
                hasError: false
              };

              if (tagCount === 0) {
                tagsProgress.value = {
                  count: 0,
                  verified: 0,
                  isVerifying: false,
                  hasError: false
                };
                return [];
              }

              const { data, error } = await system.supabaseConnector.client
                .from('tag')
                .select('id')
                .in('id', uniqueTagIds);

              if (error) throw error;
              if (signal.aborted) return null;

              ids.tagIds = data.map((tag) => tag.id);
              tagsProgress.value = {
                count: tagCount,
                verified: data.length,
                isVerifying: false,
                hasError: data.length !== tagCount
              };

              if (data.length !== tagCount) {
                setHasError(true);
                console.warn(
                  `🔍 [Offload Verification] Tag mismatch: local=${tagCount}, cloud=${data.length}`
                );
              }

              updateTotal();
              console.log(
                `✅ [Offload Verification] Tags verified: ${data.length}/${tagCount}`
              );
              return data;
            } catch (error) {
              console.error(
                '🔍 [Offload Verification] Error verifying tags:',
                error
              );
              tagsProgress.value = {
                count: tagsProgress.value.count,
                verified: 0,
                isVerifying: false,
                hasError: true
              };
              setHasError(true);
              return null;
            }
          })()
        ]);

        // ============================================================================
        // PHASE 3: Verify audio via the server's own confirmation
        // ============================================================================
        // `audio_uploaded_at` is stamped by a server trigger when the storage
        // object exists for the acl row, for both flat and legacy `local/`
        // object names. That is the source of truth; listing Storage per
        // file was one round trip per take and mishandled legacy names.
        console.log('🔍 [Offload Verification] Phase 3: Verifying attachments');

        const audioValues =
          assetContentLinksResult?.flatMap((link) =>
            (link.audio ?? [])
              .filter((value): value is string => !!value)
              .map((value) => ({
                value,
                confirmed: link.audio_uploaded_at != null
              }))
          ) ?? [];

        const attachmentCount = audioValues.length;
        const confirmedValues = audioValues.filter((item) => item.confirmed);
        const verifiedCount = confirmedValues.length;
        ids.attachmentIds = confirmedValues.map((item) => item.value);

        attachmentsProgress.value = {
          count: attachmentCount,
          verified: verifiedCount,
          isVerifying: false,
          hasError: verifiedCount !== attachmentCount
        };

        if (verifiedCount !== attachmentCount) {
          setHasError(true);
          console.warn(
            `🔍 [Offload Verification] Attachment mismatch: referenced=${attachmentCount}, confirmed=${verifiedCount}`
          );
        }

        updateTotal();
        console.log(
          `✅ [Offload Verification] Attachments verified: ${verifiedCount}/${attachmentCount}`
        );
      } else {
        // No assets, set everything to 0
        assetsProgress.value = {
          count: 0,
          verified: 0,
          isVerifying: false,
          hasError: false
        };
        assetContentLinksProgress.value = {
          count: 0,
          verified: 0,
          isVerifying: false,
          hasError: false
        };
        votesProgress.value = {
          count: 0,
          verified: 0,
          isVerifying: false,
          hasError: false
        };
        assetTagLinksProgress.value = {
          count: 0,
          verified: 0,
          isVerifying: false,
          hasError: false
        };
        tagsProgress.value = {
          count: 0,
          verified: 0,
          isVerifying: false,
          hasError: false
        };
        languagesProgress.value = {
          count: 0,
          verified: 0,
          isVerifying: false,
          hasError: false
        };
        attachmentsProgress.value = {
          count: 0,
          verified: 0,
          isVerifying: false,
          hasError: false
        };
      }

      updateTotal();
      setVerifiedIds(ids);
      console.log(
        `✅ [Offload Verification] Verification complete! Total verified: ${totalRecordsShared.value}`
      );
    } catch (error) {
      console.error('🔍 [Offload Verification] Unexpected error:', error);
      setHasError(true);
    } finally {
      setIsVerifying(false);
      abortControllerRef.current = null;
    }
  }, [
    questId,
    isVerifying,
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
    attachmentsProgress,
    totalRecordsShared,
    updateTotal
  ]);

  const cancel = useCallback(() => {
    console.log('🔍 [Offload Verification] Cancelling verification');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsVerifying(false);
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
    isVerifying,
    isDraft,
    hasPendingUploads,
    pendingUploadCount,
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
      languages: languagesProgress,
      attachments: attachmentsProgress
    },
    totalRecordsShared,
    verifiedIds,
    hasError,
    cancel,
    startVerification
  };
}
