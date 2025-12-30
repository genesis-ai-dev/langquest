import { system } from '@/db/powersync/system';
import { AppConfig } from '@/db/supabase/AppConfig';
import { getDirectory } from '@/utils/fileUtils';
import { AttachmentState } from '@powersync/attachments';
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
  estimatedStorageBytes: number;
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
 * Ryder: Future incremental offload - Could add a `categories` parameter to only verify
 * specific record types (e.g., just audio files, keep translations). Would need category-specific
 * verification and deletion logic.
 */
export function useQuestOffloadVerification(
  questId: string
): VerificationState {
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasPendingUploads, setHasPendingUploads] = useState(false);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [estimatedStorageBytes, setEstimatedStorageBytes] = useState(0);
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
      // PHASE 1: Check for pending uploads
      // ============================================================================
      console.log(
        '🔍 [Offload Verification] Phase 1: Checking for pending uploads'
      );

      // Check PowerSync upload queue (ps_crud table tracks pending operations)
      // Any rows in ps_crud means there are pending changes to upload
      const pendingRecordsResult = await system.powersync.getAll<{
        count: number;
      }>(`SELECT COUNT(*) as count FROM ps_crud`);
      const pendingDbRecords = pendingRecordsResult[0]?.count || 0;

      // Check attachment upload queue
      const pendingAttachmentsResult = await system.powersync.getAll<{
        count: number;
      }>(`SELECT COUNT(*) as count FROM attachments WHERE state = ?`, [
        String(AttachmentState.QUEUED_UPLOAD)
      ]);
      const pendingAttachmentRecords = pendingAttachmentsResult[0]?.count || 0;

      const totalPending = pendingDbRecords + pendingAttachmentRecords;

      if (totalPending > 0) {
        console.warn(
          `🔍 [Offload Verification] Found ${totalPending} pending uploads (${pendingDbRecords} DB records, ${pendingAttachmentRecords} attachments)`
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

      // First, get local quest data to know what to verify
      const localQuestData = await system.db.query.quest.findFirst({
        where: (quest, { eq }) => eq(quest.id, questId)
      });

      if (!localQuestData) {
        throw new Error(`Quest ${questId} not found locally`);
      }

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
                .eq('active', true)
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
                .eq('quest_id', questId)
                .eq('active', true);

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
                .eq('quest_id', questId)
                .eq('active', true);

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
                  .select('id')
                  .in('id', assetIds)
                  .eq('active', true)
                  .overrideTypes<{ id: string }[]>();

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
                      languoid_id: true,
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
                  .select('id, languoid_id, audio')
                  .in('asset_id', assetIds)
                  .eq('active', true)
                  .overrideTypes<
                    {
                      id: string;
                      languoid_id: string;
                      audio: string[] | null;
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
                  .in('asset_id', assetIds)
                  .eq('active', true);

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
            // Get languoids from project_language_link
            const { data: projectLanguageLinks, error } =
              await system.supabaseConnector.client
                .from('project_language_link')
                .select('languoid_id')
                .eq('project_id', questResult.project_id)
                .not('languoid_id', 'is', null);

            if (!error && projectLanguageLinks) {
              projectLanguageLinks.forEach((link) => {
                if (link.languoid_id) languageIds.add(link.languoid_id);
              });
            }
          } catch (error) {
            console.error(
              '🔍 [Offload Verification] Error fetching project languoids:',
              error
            );
          }
        }

        assetContentLinksResult?.forEach((link) => {
          if (link.languoid_id) languageIds.add(link.languoid_id);
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
                .in('asset_id', assetIds)
                .eq('active', true);

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
                .in('id', uniqueTagIds)
                .eq('active', true);

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
        // PHASE 3: Verify attachments in cloud storage
        // ============================================================================
        console.log('🔍 [Offload Verification] Phase 3: Verifying attachments');

        // Extract all audio file IDs from asset_content_link records
        const audioFileIds =
          assetContentLinksResult
            ?.flatMap((link) => link.audio)
            .filter(Boolean) || [];

        const attachmentCount = audioFileIds.length;
        attachmentsProgress.value = {
          count: attachmentCount,
          verified: 0,
          isVerifying: true,
          hasError: false
        };

        if (attachmentCount > 0) {
          try {
            let totalSize = 0;
            let verifiedCount = 0;

            // Verify each attachment exists in cloud storage
            for (const audioId of audioFileIds) {
              if (signal.aborted) break;

              try {
                const folder = getDirectory(audioId);
                // Check if file exists in Supabase Storage
                const { data, error } =
                  await system.supabaseConnector.client.storage
                    .from(AppConfig.supabaseBucket)
                    .list(folder ?? '', {
                      limit: 1,
                      search: audioId
                    });

                if (!error && data && data.length > 0) {
                  verifiedCount++;
                  ids.attachmentIds.push(audioId);
                  // Add file size to estimate
                  const fileSize = data[0]?.metadata?.size || 0;
                  totalSize += fileSize;
                }

                // Update progress
                attachmentsProgress.value = {
                  count: attachmentCount,
                  verified: verifiedCount,
                  isVerifying: true,
                  hasError: false
                };
              } catch (error) {
                console.error(
                  `🔍 [Offload Verification] Error checking attachment ${audioId}:`,
                  error
                );
              }
            }

            attachmentsProgress.value = {
              count: attachmentCount,
              verified: verifiedCount,
              isVerifying: false,
              hasError: verifiedCount !== attachmentCount
            };

            if (verifiedCount !== attachmentCount) {
              setHasError(true);
              console.warn(
                `🔍 [Offload Verification] Attachment mismatch: local=${attachmentCount}, cloud=${verifiedCount}`
              );
            }

            setEstimatedStorageBytes(totalSize);
            updateTotal();
            console.log(
              `✅ [Offload Verification] Attachments verified: ${verifiedCount}/${attachmentCount} (~${(totalSize / 1024 / 1024).toFixed(2)} MB)`
            );
          } catch (error) {
            console.error(
              '🔍 [Offload Verification] Error verifying attachments:',
              error
            );
            attachmentsProgress.value = {
              count: attachmentCount,
              verified: 0,
              isVerifying: false,
              hasError: true
            };
            setHasError(true);
          }
        } else {
          attachmentsProgress.value = {
            count: 0,
            verified: 0,
            isVerifying: false,
            hasError: false
          };
        }
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
    estimatedStorageBytes,
    cancel,
    startVerification
  };
}
