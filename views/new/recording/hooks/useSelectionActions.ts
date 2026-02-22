/**
 * useSelectionActions – shared hook for batch selection actions.
 *
 * Consolidates merge, delete, unmerge, trim, and select-all logic
 * so every view that renders RecordSelectionControls uses one source
 * of truth instead of duplicating handlers.
 *
 * View-specific post-operation cleanup is handled via optional callbacks.
 */

import { useAuth } from '@/contexts/AuthContext';
import {
  mergeLocalAssets,
  unmergeLocalAsset
} from '@/database_services/assetMergeService';
import { audioSegmentService } from '@/database_services/audioSegmentService';
import { asset_content_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useMergeUnmergeCleanup } from '@/hooks/useMergeUnmergeCleanup';
import { useLocalization } from '@/hooks/useLocalization';
import type { AssetAudio } from '@/services/assetAudio';
import { useLocalStore } from '@/store/localStore';
import RNAlert from '@blazejkustra/react-native-alert';
import { eq } from 'drizzle-orm';
import React from 'react';
import { useTrimModal } from './useTrimModal';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SelectableAsset {
  id: string;
  name: string | null;
  source?: string | 'local' | 'synced' | 'cloud';
}

interface UseSelectionActionsOptions {
  selectedAssetIds: Set<string>;
  assets: SelectableAsset[];
  isSelectionMode: boolean;
  selectMultiple: (ids: string[]) => void;
  cancelSelection: () => void;
  /** Called after a successful merge, before shared cleanup. */
  onAfterMerge?: (targetAssetId: string) => void;
  /** Called after a successful delete, before shared cleanup. */
  onAfterDelete?: (deletedIds: string[]) => void;
  /** Called after a successful unmerge, before shared cleanup. */
  onAfterUnmerge?: (originalId: string, newIds: string[]) => void;
  /** Waveform data captured during recording (keyed by asset ID). */
  assetWaveformData?: Map<string, number[]>;
}

// ── Return type ────────────────────────────────────────────────────────────

export interface SelectionControlsProps {
  selectedCount: number;
  allSelected: boolean;
  enableMerge: boolean;
  showUnmerge: boolean;
  canTrim: boolean;
  onCancel: () => void;
  onMerge: () => void;
  onDelete: () => void;
  onUnmerge: () => void;
  onTrim: () => void;
  onSelectAll: () => void;
}

export interface TrimModalState {
  isOpen: boolean;
  targetName: string | null;
  waveformData: number[] | undefined;
  assetAudio: AssetAudio | null;
  onClose: () => void;
  onConfirm: (trimmedAudio: AssetAudio) => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useSelectionActions({
  selectedAssetIds,
  assets,
  isSelectionMode,
  selectMultiple,
  cancelSelection,
  onAfterMerge,
  onAfterDelete,
  onAfterUnmerge,
  assetWaveformData
}: UseSelectionActionsOptions) {
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  const enableMerge = useLocalStore((s) => s.enableMerge);
  const { afterMerge, afterUnmerge } = useMergeUnmergeCleanup(cancelSelection);

  // ── Trim modal (delegate to existing shared hook) ─────────────────────────
  const {
    isTrimModalOpen,
    handleOpenTrimModal,
    handleCloseTrimModal,
    handleConfirmTrim,
    trimTargetAsset,
    trimWaveformData,
    trimAssetAudio,
    canTrimSelected
  } = useTrimModal({
    selectedAssetIds,
    assets,
    assetWaveformData
  });

  // ── Show unmerge (async segment-count check) ─────────────────────────────

  const [showUnmerge, setShowUnmerge] = React.useState(false);

  React.useEffect(() => {
    if (selectedAssetIds.size !== 1) {
      setShowUnmerge(false);
      return;
    }
    const assetId = Array.from(selectedAssetIds)[0]!;
    let cancelled = false;
    system.db.query.asset_content_link
      .findMany({
        columns: { id: true },
        where: eq(asset_content_link.asset_id, assetId)
      })
      .then((links) => {
        if (!cancelled) setShowUnmerge(links.length > 1);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAssetIds]);

  // ── All-selected ─────────────────────────────────────────────────────────

  const allSelected = React.useMemo(() => {
    if (!isSelectionMode || assets.length === 0) return false;
    const selectable = assets.filter((a) => a.source !== 'cloud');
    if (selectable.length === 0) return false;
    return selectable.every((a) => selectedAssetIds.has(a.id));
  }, [isSelectionMode, assets, selectedAssetIds]);

  const handleSelectAll = React.useCallback(() => {
    if (allSelected) {
      selectMultiple([]);
    } else {
      selectMultiple(
        assets.filter((a) => a.source !== 'cloud').map((a) => a.id)
      );
    }
  }, [allSelected, assets, selectMultiple]);

  // ── Merge ────────────────────────────────────────────────────────────────

  const handleMerge = React.useCallback(() => {
    const selected = assets.filter(
      (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
    );
    if (selected.length < 2 || !currentUser) return;

    RNAlert.alert(
      t('mergeAssets') || 'Merge Assets',
      t('mergeAssetsConfirmation', {
        count: selected.length
      }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('merge') || 'Merge',
          style: 'destructive',
          isPreferred: true,
          onPress: () => {
            void (async () => {
              try {
                const { targetAssetId } = await mergeLocalAssets({
                  orderedAssetIds: selected.map((a) => a.id),
                  userId: currentUser.id
                });
                onAfterMerge?.(targetAssetId);
                afterMerge(targetAssetId);
              } catch (e) {
                console.error('Failed to merge assets', e);
                RNAlert.alert(
                  t('error'),
                  t('failedToMergeAssets')
                );
              }
            })();
          }
        }
      ]
    );
  }, [assets, selectedAssetIds, currentUser, afterMerge, onAfterMerge, t]);

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = React.useCallback(() => {
    const selected = assets.filter(
      (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
    );
    if (selected.length < 1) return;

    RNAlert.alert(
      t('deleteAssets') || 'Delete Assets',
      t('deleteAssetsConfirmation', {
        count: selected.length
      }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete') || 'Delete',
          style: 'destructive',
          isPreferred: true,
          onPress: () => {
            void (async () => {
              try {
                for (const asset of selected) {
                  await audioSegmentService.deleteAudioSegment(asset.id);
                }
                const deletedIds = selected.map((a) => a.id);
                onAfterDelete?.(deletedIds);
                cancelSelection();
              } catch (e) {
                console.error('Failed to delete assets', e);
                RNAlert.alert(
                  t('error'),
                  t('failedToDeleteAssets')
                );
              }
            })();
          }
        }
      ]
    );
  }, [assets, selectedAssetIds, cancelSelection, onAfterDelete, t]);

  // ── Unmerge ──────────────────────────────────────────────────────────────

  const handleUnmerge = React.useCallback(() => {
    const selectedAsset = assets.find(
      (a) => selectedAssetIds.has(a.id) && a.source !== 'cloud'
    );
    if (!selectedAsset || !currentUser) return;

    RNAlert.alert(
      t('unmergeAsset') || 'Unmerge Asset',
      t('unmergeAssetConfirmation', {
        name: selectedAsset.name ?? t('asset')
      }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('unmerge') || 'Unmerge',
          isPreferred: true,
          onPress: () => {
            void (async () => {
              try {
                const { originalAssetId, newAssets } =
                  await unmergeLocalAsset({
                    assetId: selectedAsset.id,
                    userId: currentUser.id
                  });
                onAfterUnmerge?.(
                  originalAssetId,
                  newAssets.map((a) => a.id)
                );
                afterUnmerge(
                  originalAssetId,
                  newAssets.map((a) => a.id)
                );
              } catch (e) {
                console.error('Failed to unmerge asset', e);
                RNAlert.alert(
                  t('error'),
                  e instanceof Error
                    ? e.message
                    : t('failedToUnmergeAsset')
                );
              }
            })();
          }
        }
      ]
    );
  }, [assets, selectedAssetIds, currentUser, afterUnmerge, onAfterUnmerge, t]);

  // ── Assembled return values ──────────────────────────────────────────────

  const controlsProps: SelectionControlsProps = React.useMemo(
    () => ({
      selectedCount: selectedAssetIds.size,
      allSelected,
      enableMerge,
      showUnmerge,
      canTrim: canTrimSelected,
      onCancel: cancelSelection,
      onMerge: handleMerge,
      onDelete: handleDelete,
      onUnmerge: handleUnmerge,
      onTrim: () => void handleOpenTrimModal(),
      onSelectAll: handleSelectAll
    }),
    [
      selectedAssetIds.size,
      allSelected,
      enableMerge,
      showUnmerge,
      canTrimSelected,
      cancelSelection,
      handleMerge,
      handleDelete,
      handleUnmerge,
      handleOpenTrimModal,
      handleSelectAll
    ]
  );

  const trimModal: TrimModalState = React.useMemo(
    () => ({
      isOpen: isTrimModalOpen,
      targetName: trimTargetAsset?.name ?? null,
      waveformData: trimWaveformData,
      assetAudio: trimAssetAudio,
      onClose: handleCloseTrimModal,
      onConfirm: (trimmed: AssetAudio) => void handleConfirmTrim(trimmed)
    }),
    [
      isTrimModalOpen,
      trimTargetAsset,
      trimWaveformData,
      trimAssetAudio,
      handleCloseTrimModal,
      handleConfirmTrim
    ]
  );

  return { controlsProps, trimModal };
}
