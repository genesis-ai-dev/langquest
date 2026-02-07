/**
 * useTrimModal – shared hook for trim-segment modal state & waveform loading.
 *
 * Used by RecordingViewSimplified, BibleRecordingView, and BibleAssetsView.
 *
 * Recording views already have waveform data captured during recording, so
 * the modal opens instantly.  BibleAssetsView does NOT have waveform data
 * up-front, so the hook falls back to reading the audio file and extracting
 * a real waveform on the fly.
 */

import { extractWaveformFromFile } from '@/utils/audioWaveform';
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
   * extract waveform data from the audio file.
   */
  assetWaveformData?: Map<string, number[]>;
  /**
   * Resolver that returns local audio URIs for a given asset ID.
   * Required when the view does NOT have waveform data from recording
   * (e.g. BibleAssetsView).  If omitted, the hook will only open the
   * modal when waveform data already exists.
   */
  getAssetAudioUris?: (assetId: string) => Promise<string[]>;
}

interface UseTrimModalReturn {
  /** Whether the trim modal is currently open */
  isTrimModalOpen: boolean;
  /** Open the trim modal for the first selected asset */
  handleOpenTrimModal: () => void;
  /** Close the trim modal and reset target */
  handleCloseTrimModal: () => void;
  /** The asset currently targeted for trimming (or null) */
  trimTargetAsset: AssetLike | null;
  /** Waveform amplitude data for the trim target (or undefined) */
  trimWaveformData: number[] | undefined;
  /** Audio URI for the trim target (first URI if multiple exist, or undefined) */
  trimAudioUri: string | undefined;
  /** Whether trim is available for the current selection */
  canTrimSelected: boolean;
  /**
   * Setter to store waveform data externally (e.g. after a recording
   * completes).  Merges into the internal map.
   */
  setWaveformData: (assetId: string, data: number[]) => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTrimModal({
  selectedAssetIds,
  assets,
  assetWaveformData: externalWaveformData,
  getAssetAudioUris
}: UseTrimModalOptions): UseTrimModalReturn {
  // Internal waveform cache (used when loading from file)
  const [internalWaveformData, setInternalWaveformData] = React.useState<
    Map<string, number[]>
  >(new Map());

  const [isTrimModalOpen, setIsTrimModalOpen] = React.useState(false);
  const [trimTargetAssetId, setTrimTargetAssetId] = React.useState<
    string | null
  >(null);
  const [trimAudioUri, setTrimAudioUri] = React.useState<string | undefined>(
    undefined
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

    // If we can load waveform data (have a URI resolver) and asset is local
    if (getAssetAudioUris && asset.source !== 'cloud') return true;

    return false;
  }, [selectedAssetIds, assets, mergedWaveformData, getAssetAudioUris]);

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

    // If waveform data is already available, open immediately
    // But we still need to load the audio URI for playback
    if (mergedWaveformData.has(firstSelectedId)) {
      setTrimTargetAssetId(firstSelectedId);
      setIsTrimModalOpen(true);
      // Load audio URI in background for playback
      if (getAssetAudioUris) {
        void (async () => {
          try {
            const uris = await getAssetAudioUris(firstSelectedId);
            if (uris.length > 0 && uris[0]) {
              setTrimAudioUri(uris[0]);
            }
          } catch (error) {
            console.error('Failed to load audio URI for playback:', error);
          }
        })();
      }
      return;
    }

    // Otherwise, try to extract waveform from the audio file
    if (!getAssetAudioUris) {
      console.warn('No waveform data and no URI resolver – cannot open trim.');
      return;
    }

    // Async load → then open
    void (async () => {
      try {
        const uris = await getAssetAudioUris(firstSelectedId);
        if (uris.length === 0) {
          console.warn('No audio URIs found for asset:', firstSelectedId);
          return;
        }

        const firstUri = uris[0];
        if (!firstUri) return;

        console.log('🎵 Extracting waveform from:', firstUri.slice(-40));
        const waveform = await extractWaveformFromFile(firstUri, 128);
        console.log(
          `🎵 Extracted ${waveform.length} bars, peak=${Math.max(...waveform).toFixed(3)}`
        );

        setInternalWaveformData((prev) => {
          const next = new Map(prev);
          next.set(firstSelectedId, waveform);
          return next;
        });

        setTrimTargetAssetId(firstSelectedId);
        setTrimAudioUri(firstUri);
        setIsTrimModalOpen(true);
      } catch (error) {
        console.error('Failed to load audio for trimming:', error);
      }
    })();
  }, [selectedAssetIds, mergedWaveformData, getAssetAudioUris]);

  const handleCloseTrimModal = React.useCallback(() => {
    setIsTrimModalOpen(false);
    setTrimTargetAssetId(null);
    setTrimAudioUri(undefined);
  }, []);

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

  return {
    isTrimModalOpen,
    handleOpenTrimModal,
    handleCloseTrimModal,
    trimTargetAsset,
    trimWaveformData,
    trimAudioUri,
    canTrimSelected,
    setWaveformData
  };
}
