import { DownloadConfirmationModal } from '@/components/DownloadConfirmationModal';
import { QuestDownloadDiscoveryDrawer } from '@/components/QuestDownloadDiscoveryDrawer';
import { useAuth } from '@/contexts/AuthContext';
import {
  invalidateCloud,
  invalidateOfflineChapterLists
} from '@/hooks/hybridCache';
import { useLocalization } from '@/hooks/useLocalization';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useQuestDownloadDiscovery } from '@/hooks/useQuestDownloadDiscovery';
import { readQuestIsDownloaded } from '@/hooks/useQuestDownloadStatusLive';
import { useSheetHandoff } from '@/hooks/useSheetHandoff';
import { syncCallbackService } from '@/services/syncCallbackService';
import { bulkDownloadQuest } from '@/utils/bulkDownload';
import { shouldRequireQuestDownload } from '@/utils/questDownloadGate';
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

type FlowTarget = {
  mode: 'download';
  questId: string;
  openAfter?: OpenableQuest;
};

function addIds(prev: Set<string>, ids: string[]) {
  return new Set([...prev, ...ids]);
}

function removeIds(prev: Set<string>, ids: string[]) {
  const next = new Set(prev);
  ids.forEach((id) => next.delete(id));
  return next;
}

/**
 * Download for quests, shared by every project template.
 * Render `sheets` once in the calling view.
 */
export function useQuestDownloadFlow(projectId: string) {
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  const { goToQuest } = useNavigationHelpers();
  const queryClient = useQueryClient();
  const { handoff, isHandingOff, endHandoff, completeHandoff } =
    useSheetHandoff();

  const [target, setTarget] = React.useState<FlowTarget | null>(null);
  const [showDiscoveryDrawer, setShowDiscoveryDrawer] = React.useState(false);
  const [showConfirmationModal, setShowConfirmationModal] =
    React.useState(false);
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

  // startDiscovery closes over the quest ID, so it can only run after the
  // render that passed the new ID to the hook.
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
    </>
  );

  return {
    download,
    openQuest,
    downloadingQuestIds,
    downloadedQuestIds,
    sheets
  };
}
