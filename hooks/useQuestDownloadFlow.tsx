import { DownloadConfirmationModal } from '@/components/DownloadConfirmationModal';
import { QuestDownloadDiscoveryDrawer } from '@/components/QuestDownloadDiscoveryDrawer';
import { QuestOffloadVerificationDrawer } from '@/components/QuestOffloadVerificationDrawer';
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import {
  invalidateCloud,
  invalidateOfflineChapterLists
} from '@/hooks/hybridCache';
import { useLocalization } from '@/hooks/useLocalization';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useQuestDownloadDiscovery } from '@/hooks/useQuestDownloadDiscovery';
import {
  profilesIncludeUser,
  readQuestIsDownloaded
} from '@/hooks/useQuestDownloadStatusLive';
import { useQuestOffloadVerification } from '@/hooks/useQuestOffloadVerification';
import { useSheetHandoff } from '@/hooks/useSheetHandoff';
import { syncCallbackService } from '@/services/syncCallbackService';
import { bulkDownloadQuest } from '@/utils/bulkDownload';
import {
  resolveQuestDownloadAction,
  shouldRequireQuestDownload
} from '@/utils/questDownloadGate';
import { offloadQuest } from '@/utils/questOffloadUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';

const QUEST_QUERY_TYPES = [
  'quests',
  'assets',
  'current-quest',
  'download-status',
  'bible-chapters',
  'fia-pericope-quests',
  'my-projects',
  'all-projects',
  'project'
];

async function refreshQuestQueries(queryClient: QueryClient) {
  await invalidateCloud(queryClient, ...QUEST_QUERY_TYPES);
  await invalidateOfflineChapterLists(queryClient);
}

export interface OpenableQuest {
  id: string;
  name?: string | null;
  source?: string;
}

type FlowTarget =
  | { mode: 'download'; questId: string; openAfter?: OpenableQuest }
  | { mode: 'offload'; questId: string; leaveQuest: boolean };

function addIds(prev: Set<string>, ids: string[]) {
  return new Set([...prev, ...ids]);
}

function removeIds(prev: Set<string>, ids: string[]) {
  const next = new Set(prev);
  ids.forEach((id) => next.delete(id));
  return next;
}

/**
 * Download and offload for quests, shared by every project template.
 * Render `sheets` once in the calling view.
 */
export function useQuestDownloadFlow(projectId: string) {
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  const { goToQuest, goToProjectDirectory } = useNavigationHelpers();
  const isConnected = useNetworkStatus();
  const queryClient = useQueryClient();
  const { handoff, isHandingOff, endHandoff, completeHandoff } =
    useSheetHandoff();

  const [target, setTarget] = React.useState<FlowTarget | null>(null);
  const [showDiscoveryDrawer, setShowDiscoveryDrawer] = React.useState(false);
  const [showConfirmationModal, setShowConfirmationModal] =
    React.useState(false);
  const [showOffloadDrawer, setShowOffloadDrawer] = React.useState(false);
  const [isOffloading, setIsOffloading] = React.useState(false);
  const [downloadingQuestIds, setDownloadingQuestIds] = React.useState<
    Set<string>
  >(new Set());
  // Download flags set on the server that PowerSync has not synced down yet.
  const [downloadedQuestIds, setDownloadedQuestIds] = React.useState<
    Set<string>
  >(new Set());

  const discoveryState = useQuestDownloadDiscovery(
    target?.mode === 'download' ? target.questId : ''
  );
  const verificationState = useQuestOffloadVerification(
    target?.mode === 'offload' ? target.questId : ''
  );

  // startDiscovery/startVerification close over the quest ID, so they can
  // only run after the render that passed the new ID to their hooks.
  const startedDiscoveryRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!showDiscoveryDrawer) {
      startedDiscoveryRef.current = null;
      return;
    }
    if (
      target?.mode !== 'download' ||
      discoveryState.isDiscovering ||
      startedDiscoveryRef.current === target.questId
    ) {
      return;
    }
    startedDiscoveryRef.current = target.questId;
    discoveryState.startDiscovery();
  }, [showDiscoveryDrawer, target, discoveryState]);

  const startedVerificationRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!showOffloadDrawer) {
      startedVerificationRef.current = null;
      return;
    }
    if (
      target?.mode !== 'offload' ||
      !isConnected ||
      verificationState.isVerifying ||
      startedVerificationRef.current === target.questId
    ) {
      return;
    }
    startedVerificationRef.current = target.questId;
    verificationState.startVerification();
  }, [showOffloadDrawer, target, isConnected, verificationState]);

  const isKnownDownloaded = async (questId: string) => {
    if (!currentUser) return false;
    if (downloadedQuestIds.has(questId) || downloadingQuestIds.has(questId)) {
      return true;
    }
    return readQuestIsDownloaded(questId, currentUser.id);
  };

  const download = (questId: string, openAfter?: OpenableQuest) => {
    if (!currentUser || target) return;
    setTarget({ mode: 'download', questId, openAfter });
    setShowDiscoveryDrawer(true);
  };

  const offload = (questId: string, options?: { leaveQuest?: boolean }) => {
    if (!currentUser || target) return;
    setTarget({
      mode: 'offload',
      questId,
      leaveQuest: options?.leaveQuest ?? false
    });
    setShowOffloadDrawer(true);
  };

  /** Download control pressed: download, offload, or do nothing. */
  const toggle = async (questId: string) => {
    if (!currentUser) return;
    const localQuest = await system.db.query.quest.findFirst({
      where: (fields, { eq }) => eq(fields.id, questId),
      columns: { download_profiles: true, published_at: true }
    });
    const action = resolveQuestDownloadAction({
      isSignedIn: true,
      isLocal: false,
      isDownloaded:
        downloadedQuestIds.has(questId) ||
        profilesIncludeUser(localQuest?.download_profiles, currentUser.id),
      isPublished: localQuest?.published_at != null
    });
    if (action === 'download') download(questId);
    else if (action === 'offload') offload(questId);
  };

  /** Quest pressed: members must download a cloud quest before opening it. */
  const openQuest = async (quest: OpenableQuest, isMember: boolean) => {
    const isCloud = quest.source === 'cloud';
    const isDownloaded = isCloud ? await isKnownDownloaded(quest.id) : false;
    if (
      shouldRequireQuestDownload({
        isSignedIn: Boolean(currentUser),
        isMember,
        isCloud,
        isDownloaded
      })
    ) {
      RNAlert.alert(t('downloadRequired'), t('downloadQuestToView'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('downloadNow'),
          isPreferred: true,
          onPress: () => download(quest.id, quest)
        }
      ]);
      return;
    }
    goToQuest({
      id: quest.id,
      project_id: projectId,
      name: quest.name ?? undefined
    });
  };

  const handleCancelDiscovery = () => {
    discoveryState.cancel();
    setShowDiscoveryDrawer(false);
    setTarget(null);
  };

  const handleCancelConfirmation = () => {
    endHandoff();
    setShowConfirmationModal(false);
    setTarget(null);
  };

  const handleConfirmDownload = async () => {
    endHandoff();
    setShowConfirmationModal(false);
    if (!currentUser || target?.mode !== 'download') {
      setTarget(null);
      return;
    }

    const { questId, openAfter } = target;
    const questIds = discoveryState.discoveredIds.questIds;
    setDownloadingQuestIds((prev) => addIds(prev, questIds));

    try {
      await bulkDownloadQuest(discoveryState.discoveredIds, currentUser.id);
    } catch (error) {
      console.error('📥 [Download] Failed:', error);
      setDownloadingQuestIds((prev) => removeIds(prev, questIds));
      setTarget(null);
      RNAlert.alert(
        t('error'),
        error instanceof Error ? error.message : String(error)
      );
      return;
    }

    setDownloadingQuestIds((prev) => removeIds(prev, questIds));
    setDownloadedQuestIds((prev) => addIds(prev, questIds));
    syncCallbackService.registerCallback(questId, () =>
      refreshQuestQueries(queryClient)
    );
    void refreshQuestQueries(queryClient);
    setTarget(null);

    if (openAfter) {
      goToQuest({
        id: openAfter.id,
        project_id: projectId,
        name: openAfter.name ?? undefined
      });
    }
  };

  const handleOffloadOpenChange = (open: boolean) => {
    if (open || isOffloading) return;
    verificationState.cancel();
    setShowOffloadDrawer(false);
    setTarget(null);
  };

  const handleOffloadContinue = async () => {
    if (target?.mode !== 'offload') return;
    const { questId, leaveQuest } = target;
    setIsOffloading(true);

    try {
      const result = await offloadQuest({
        questId,
        verifiedIds: verificationState.verifiedIds,
        onProgress: (progress, message) => {
          console.log(`🗑️ [Offload Progress] ${progress}%: ${message}`);
        }
      });

      setDownloadedQuestIds((prev) => removeIds(prev, [questId]));
      if (!result.localRowsRemoved) {
        syncCallbackService.registerCallback(questId, () =>
          refreshQuestQueries(queryClient)
        );
      }
      await refreshQuestQueries(queryClient);

      setShowOffloadDrawer(false);
      setTarget(null);
      if (leaveQuest) goToProjectDirectory();
      RNAlert.alert(
        t('success'),
        result.localRowsRemoved ? t('offloadComplete') : t('offloadSyncPending')
      );
    } catch (error) {
      console.error('🗑️ [Offload] Failed:', error);
      RNAlert.alert(t('error'), t('offloadError'));
    } finally {
      setIsOffloading(false);
    }
  };

  const { progressSharedValues } = discoveryState;
  const sheets = (
    <>
      <QuestDownloadDiscoveryDrawer
        isOpen={showDiscoveryDrawer}
        onOpenChange={(open) => {
          if (open) return;
          if (isHandingOff()) completeHandoff();
          else handleCancelDiscovery();
        }}
        onContinue={() =>
          handoff(
            () => setShowDiscoveryDrawer(false),
            () => setShowConfirmationModal(true)
          )
        }
        discoveryState={discoveryState}
      />
      <DownloadConfirmationModal
        visible={showConfirmationModal}
        onConfirm={() => void handleConfirmDownload()}
        onCancel={handleCancelConfirmation}
        downloadType="quest"
        discoveredCounts={{
          Quests: progressSharedValues.quest.value.count,
          Projects: progressSharedValues.project.value.count,
          'Quest-Asset Links': progressSharedValues.questAssetLinks.value.count,
          Assets: progressSharedValues.assets.value.count,
          'Asset Content Links':
            progressSharedValues.assetContentLinks.value.count,
          Votes: progressSharedValues.votes.value.count,
          'Quest Tags': progressSharedValues.questTagLinks.value.count,
          'Asset Tags': progressSharedValues.assetTagLinks.value.count,
          Tags: progressSharedValues.tags.value.count,
          Languages: progressSharedValues.languages.value.count
        }}
      />
      <QuestOffloadVerificationDrawer
        isOpen={showOffloadDrawer}
        onOpenChange={handleOffloadOpenChange}
        onContinue={() => void handleOffloadContinue()}
        verificationState={verificationState}
        isOffloading={isOffloading}
      />
    </>
  );

  return {
    toggle,
    download,
    offload,
    openQuest,
    /** Quest whose download drawer is open, for a spinner on its row. */
    pendingDownloadQuestId: target?.mode === 'download' ? target.questId : null,
    downloadingQuestIds,
    downloadedQuestIds,
    sheets
  };
}
