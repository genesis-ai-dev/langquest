/**
 * useTrimModal – shared hook for trim-segment modal state & waveform loading.
 *
 * Used by RecordingViewSimplified, BibleRecordingView, and BibleAssetsView.
 *
 * Recording views already have waveform data captured during recording, so
 * the modal can use that instead of loading from file.  BibleAssetsView does
 * NOT have waveform data up-front, so the hook loads it via getAssetWaveform.
 *
 * Waveforms are always freshly loaded on each modal open (no internal cache)
 * to avoid stale data after trim, merge, or unmerge operations.
 *
 * Asset audio is imported dynamically when opening the modal to avoid
 * loading it during initial app startup (can cause blank screen).
 */

import type { AssetAudio } from '@/services/assetAudio';
import React from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface AssetLike {
  id: string;
  name: string | null;
  source?: string | 'local' | 'synced' | 'cloud';
}

interface UseTrimModalOptions {
  /** Current set of selected asset IDs (from useSelectionMode) */
  selectedAssetIds: Set<string>;
  /** Full list of assets visible in the current view */
  assets: AssetLike[];
  /**
   * Waveform data captured during recording (keyed by asset ID).
   * If provided for the target asset, used instead of loading from file.
   */
  assetWaveformData?: Map<string, number[]>;
}

interface UseTrimModalReturn {
  /** Whether the trim modal is currently open */
  isTrimModalOpen: boolean;
  /** Open the trim modal for the first selected asset */
  handleOpenTrimModal: () => void;
  /** Close the trim modal and reset target */
  handleCloseTrimModal: () => void;
  /** Confirm trim: persist the trimmed AssetAudio to the DB and close */
  handleConfirmTrim: (trimmedAudio: AssetAudio) => void;
  /** The asset currently targeted for trimming (or null) */
  trimTargetAsset: AssetLike | null;
  /** Waveform amplitude data for the trim target (or undefined) */
  trimWaveformData: number[] | undefined;
  /** Resolved AssetAudio for the trim target (or null) */
  trimAssetAudio: AssetAudio | null;
  /** Whether trim is available for the current selection */
  canTrimSelected: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTrimModal({
  selectedAssetIds,
  assets,
  assetWaveformData: externalWaveformData
}: UseTrimModalOptions): UseTrimModalReturn {
  const [isTrimModalOpen, setIsTrimModalOpen] = React.useState(false);
  const [trimTargetAssetId, setTrimTargetAssetId] = React.useState<
    string | null
  >(null);
  const [trimAssetAudio, setTrimAssetAudio] = React.useState<AssetAudio | null>(
    null
  );
  const [trimWaveform, setTrimWaveform] = React.useState<number[] | undefined>(
    undefined
  );

  // ── Derived values ─────────────────────────────────────────────────────

  const trimTargetAsset = React.useMemo(() => {
    if (!trimTargetAssetId) return null;
    return assets.find((a) => a.id === trimTargetAssetId) ?? null;
  }, [assets, trimTargetAssetId]);

  const canTrimSelected = React.useMemo(() => {
    if (selectedAssetIds.size !== 1) return false;
    const selectedId = Array.from(selectedAssetIds)[0];
    if (!selectedId) return false;

    const asset = assets.find((a) => a.id === selectedId);
    if (!asset) return false;

    if (asset.source !== 'cloud') return true;

    return false;
  }, [selectedAssetIds, assets]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleOpenTrimModal = React.useCallback(() => {
    if (selectedAssetIds.size < 1) return;

    const selectedIds = Array.from(selectedAssetIds);
    const firstSelectedId = selectedIds[0];
    if (!firstSelectedId) return;

    if (selectedIds.length > 1) {
      console.warn(
        'Trim modal opened with multiple selected assets; using first selection.'
      );
    }

    const asset = assets.find((a) => a.id === firstSelectedId);
    if (asset?.source === 'cloud') {
      console.warn('Cannot trim cloud-only assets (no local audio).');
      return;
    }

    void (async () => {
      try {
        const { resolveAssetAudio, getAssetWaveform } =
          await import('@/services/assetAudio');

        const resolved = await resolveAssetAudio(firstSelectedId);
        if (!resolved || resolved.segments.length === 0) {
          console.warn('No audio found for asset:', firstSelectedId);
          return;
        }

        // Use recording-time waveform if available; otherwise load fresh.
        // Single-segment: ignoreTrim shows the full file.
        // Multi-segment: ignoreExteriorTrims hides locked interior trims
        // while exposing the adjustable exterior edges.
        const isMerged = resolved.segments.length > 1;
        const existing = !isMerged
          ? externalWaveformData?.get(firstSelectedId)
          : undefined;
        if (existing && existing.length > 0) {
          setTrimWaveform(existing);
        } else {
          const waveform = await getAssetWaveform(firstSelectedId, {
            ignoreTrim: !isMerged,
            ignoreExteriorTrims: isMerged,
            barCount: 128
          });
          setTrimWaveform(waveform ?? []);
        }

        setTrimTargetAssetId(firstSelectedId);
        setTrimAssetAudio(resolved);
        setIsTrimModalOpen(true);
      } catch (error) {
        console.error('Failed to load audio for trimming:', error);
      }
    })();
  }, [selectedAssetIds, externalWaveformData, assets]);

  const handleCloseTrimModal = React.useCallback(() => {
    setIsTrimModalOpen(false);
    setTrimTargetAssetId(null);
    setTrimAssetAudio(null);
    setTrimWaveform(undefined);
  }, []);

  const handleConfirmTrim = React.useCallback((trimmedAudio: AssetAudio) => {
    void (async () => {
      try {
        const { saveTrim } = await import('@/services/assetAudio');
        await saveTrim(trimmedAudio);
      } catch (error) {
        console.error('Failed to save trim:', error);
      }
      setIsTrimModalOpen(false);
      setTrimTargetAssetId(null);
      setTrimAssetAudio(null);
      setTrimWaveform(undefined);
    })();
  }, []);

  return {
    isTrimModalOpen,
    handleOpenTrimModal,
    handleCloseTrimModal,
    handleConfirmTrim,
    trimTargetAsset,
    trimWaveformData: trimWaveform,
    trimAssetAudio,
    canTrimSelected
  };
}
