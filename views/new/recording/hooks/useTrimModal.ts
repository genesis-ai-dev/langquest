/**
 * useTrimModal – shared hook for trim-segment modal state & waveform loading.
 *
 * Used by RecordingViewSimplified, BibleRecordingView, and BibleAssetsView.
 *
 * Recording views already have waveform data captured during recording, so
 * the modal opens instantly.  BibleAssetsView does NOT have waveform data
 * up-front, so the hook falls back to Asset audio (resolveAssetAudio +
 * getAssetWaveform) to load URIs, durations, and waveform on the fly.
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
   * If provided, the hook will look here first before attempting to
   * load waveform via Asset audio (getAssetWaveform).
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
  /**
   * Setter to store waveform data externally (e.g. after a recording
   * completes).  Merges into the internal map.
   */
  setWaveformData: (assetId: string, data: number[]) => void;
  /** Remove cached waveform for an asset so it is reloaded on next open */
  clearWaveformData: (assetId: string) => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTrimModal({
  selectedAssetIds,
  assets,
  assetWaveformData: externalWaveformData
}: UseTrimModalOptions): UseTrimModalReturn {
  // Internal waveform cache (used when loading from file)
  const [internalWaveformData, setInternalWaveformData] = React.useState<
    Map<string, number[]>
  >(new Map());

  const [isTrimModalOpen, setIsTrimModalOpen] = React.useState(false);
  const [trimTargetAssetId, setTrimTargetAssetId] = React.useState<
    string | null
  >(null);
  const [trimAssetAudio, setTrimAssetAudio] = React.useState<AssetAudio | null>(
    null
  );

  // Merge external (recording-time) data with internally-loaded data.
  // External takes priority since it's captured from real metering.
  const mergedWaveformData = React.useMemo(() => {
    if (!externalWaveformData || externalWaveformData.size === 0) {
      return internalWaveformData;
    }
    if (internalWaveformData.size === 0) {
      return externalWaveformData;
    }
    const merged = new Map(internalWaveformData);
    for (const [key, value] of externalWaveformData) {
      merged.set(key, value); // external wins
    }
    return merged;
  }, [externalWaveformData, internalWaveformData]);

  // ── Derived values ─────────────────────────────────────────────────────

  const trimTargetAsset = React.useMemo(() => {
    if (!trimTargetAssetId) return null;
    return assets.find((a) => a.id === trimTargetAssetId) ?? null;
  }, [assets, trimTargetAssetId]);

  const trimWaveformData = React.useMemo(() => {
    if (!trimTargetAssetId) return undefined;
    return mergedWaveformData.get(trimTargetAssetId);
  }, [mergedWaveformData, trimTargetAssetId]);

  const canTrimSelected = React.useMemo(() => {
    if (selectedAssetIds.size !== 1) return false;
    const selectedId = Array.from(selectedAssetIds)[0];
    if (!selectedId) return false;

    const asset = assets.find((a) => a.id === selectedId);
    if (!asset) return false;

    // If we already have waveform data, trim is available
    if (mergedWaveformData.has(selectedId)) return true;

    // If asset is local (not cloud), we can load via Asset audio
    if (asset.source !== 'cloud') return true;

    return false;
  }, [selectedAssetIds, assets, mergedWaveformData]);

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
        const { resolveAssetAudio, getAssetWaveform } = await import(
          '@/services/assetAudio'
        );

        const resolved = await resolveAssetAudio(firstSelectedId);
        if (!resolved || resolved.segments.length === 0) {
          console.warn('No audio found for asset:', firstSelectedId);
          return;
        }

        // Use existing waveform from recording if available; otherwise load
        if (!mergedWaveformData.has(firstSelectedId)) {
          const waveform = await getAssetWaveform(firstSelectedId, {
            ignoreTrim: true,
            barCount: 128
          });
          setInternalWaveformData((prev) => {
            const next = new Map(prev);
            next.set(firstSelectedId, waveform ?? []);
            return next;
          });
        }

        setTrimTargetAssetId(firstSelectedId);
        setTrimAssetAudio(resolved);
        setIsTrimModalOpen(true);
      } catch (error) {
        console.error('Failed to load audio for trimming:', error);
      }
    })();
  }, [selectedAssetIds, mergedWaveformData, assets]);

  const handleCloseTrimModal = React.useCallback(() => {
    setIsTrimModalOpen(false);
    setTrimTargetAssetId(null);
    setTrimAssetAudio(null);
  }, []);

  const handleConfirmTrim = React.useCallback(
    (trimmedAudio: AssetAudio) => {
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
      })();
    },
    []
  );

  // ── External setter (used by recording views after recording) ──────────

  const setWaveformData = React.useCallback(
    (assetId: string, data: number[]) => {
      setInternalWaveformData((prev) => {
        const next = new Map(prev);
        next.set(assetId, data);
        return next;
      });
    },
    []
  );

  const clearWaveformData = React.useCallback((assetId: string) => {
    setInternalWaveformData((prev) => {
      if (!prev.has(assetId)) return prev;
      const next = new Map(prev);
      next.delete(assetId);
      return next;
    });
  }, []);

  return {
    isTrimModalOpen,
    handleOpenTrimModal,
    handleCloseTrimModal,
    handleConfirmTrim,
    trimTargetAsset,
    trimWaveformData,
    trimAssetAudio,
    canTrimSelected,
    setWaveformData,
    clearWaveformData
  };
}
