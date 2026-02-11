/**
 * AssetAudio - Centralized audio resolution, playback, waveform, and trim.
 *
 * See docs/asset-audio.md for full API documentation and usage examples.
 *
 * DEPENDENCIES (not yet created — will cause build errors until they exist):
 *
 *  1. `utils/audioWaveform.ts` must export `extractWaveformFromFile`:
 *       export function extractWaveformFromFile(
 *         uri: string,
 *         barCount: number,
 *         options?: { normalize?: boolean }
 *       ): Promise<number[]>;
 *
 *  2. A `metadata TEXT` column on the `asset_content_link` table (both synced
 *     and local schemas). Until the migration runs, `parseTrimMetadata` will
 *     safely return `undefined`, and `saveTrim` will be a no-op since the
 *     column won't exist to write to.
 */

import type { AudioSegment } from '@/contexts/AudioContext';
import { useAudio } from '@/contexts/AudioContext';
import { system } from '@/db/powersync/system';
import { extractWaveformFromFile } from '@/utils/audioWaveform';
import { resolveTable } from '@/utils/dbUtils';
import {
  fileExists,
  getLocalAttachmentUriWithOPFS
} from '@/utils/fileUtils';
import { Audio } from 'expo-av';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssetAudioSegment {
  /** Local file URI */
  uri: string;
  /** Full, untrimmed duration in ms */
  durationMs: number;
  /** Trim points (relative to this segment's full duration) */
  trim?: { startMs: number; endMs: number };
  /** Content link row ID (for persisting trim back to DB) */
  contentLinkId: string;
}

export interface AssetAudio {
  assetId: string;
  segments: AssetAudioSegment[];
  /** Sum of effective (trimmed) durations across all segments */
  totalDurationMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the effective duration of a segment, respecting trim if present.
 */
function effectiveDuration(seg: AssetAudioSegment): number {
  if (seg.trim) {
    return Math.max(0, seg.trim.endMs - seg.trim.startMs);
  }
  return seg.durationMs;
}

/**
 * Compute total effective duration across all segments.
 */
function computeTotalDuration(segments: AssetAudioSegment[]): number {
  return segments.reduce((sum, seg) => sum + effectiveDuration(seg), 0);
}

/**
 * Load duration for a single audio URI by briefly creating an expo-av Sound.
 *
 * EXPO-AUDIO MIGRATION: Replace Audio.Sound.createAsync with the expo-audio
 * equivalent (AudioPlayer). This is the only direct expo-av usage in this
 * file — all playback routes through AudioContext.
 */
async function loadDuration(uri: string): Promise<number> {
  try {
    const { sound } = await Audio.Sound.createAsync({ uri });
    const status = await sound.getStatusAsync();
    await sound.unloadAsync();
    return status.isLoaded ? (status.durationMillis ?? 0) : 0;
  } catch {
    return 0;
  }
}

/**
 * Resolve a single audio value (local path, file URI, or attachment ID) to a
 * verified local file URI. Returns null if the file can't be found.
 *
 * This is the single-source-of-truth for the three-way resolution that was
 * previously duplicated across 6+ view files.
 */
async function resolveAudioValue(
  audioValue: string,
  contentLinksLocal: { asset_id: string; audio: string[] | null }[],
  assetId: string
): Promise<string | null> {
  // --- Direct local path (from saveAudioLocally) ---
  if (audioValue.startsWith('local/')) {
    const constructedUri = await getLocalAttachmentUriWithOPFS(audioValue);
    if (await fileExists(constructedUri)) return constructedUri;

    // Fallback: search attachment queue
    if (system.permAttachmentQueue) {
      const filename = audioValue.replace(/^local\//, '');
      const uuidPart = filename.split('.')[0];
      const attachment = await system.powersync.getOptional<{
        id: string;
        filename: string | null;
        local_uri: string | null;
      }>(
        `SELECT * FROM ${system.permAttachmentQueue.table} WHERE filename = ? OR filename LIKE ? OR id = ? OR id LIKE ? LIMIT 1`,
        [filename, `%${uuidPart}%`, filename, `%${uuidPart}%`]
      );
      if (attachment?.local_uri) {
        const foundUri = system.permAttachmentQueue.getLocalUri(
          attachment.local_uri
        );
        if (await fileExists(foundUri)) return foundUri;
      }
    }

    // Fallback: try local table for file:// URIs
    return findFallbackUri(contentLinksLocal, assetId);
  }

  // --- Full file URI ---
  if (audioValue.startsWith('file://')) {
    if (await fileExists(audioValue)) return audioValue;

    // Fallback: search attachment queue by filename
    if (system.permAttachmentQueue) {
      const filename = audioValue.split('/').pop();
      if (filename) {
        const attachment = await system.powersync.getOptional<{
          id: string;
          filename: string | null;
          local_uri: string | null;
        }>(
          `SELECT * FROM ${system.permAttachmentQueue.table} WHERE filename = ? OR id = ? LIMIT 1`,
          [filename, filename]
        );
        if (attachment?.local_uri) {
          const foundUri = system.permAttachmentQueue.getLocalUri(
            attachment.local_uri
          );
          if (await fileExists(foundUri)) return foundUri;
        }
      }
    }
    return null;
  }

  // --- Attachment ID ---
  if (system.permAttachmentQueue) {
    const attachment = await system.powersync.getOptional<{
      id: string;
      local_uri: string | null;
    }>(
      `SELECT * FROM ${system.permAttachmentQueue.table} WHERE id = ?`,
      [audioValue]
    );
    if (attachment?.local_uri) {
      const localUri = system.permAttachmentQueue.getLocalUri(
        attachment.local_uri
      );
      if (await fileExists(localUri)) return localUri;
    }
  }

  // Fallback: try local table
  return findFallbackUri(contentLinksLocal, assetId);
}

/**
 * Last-resort fallback: scan local content link rows for any working URI.
 */
async function findFallbackUri(
  contentLinksLocal: { asset_id: string; audio: string[] | null }[],
  assetId: string
): Promise<string | null> {
  const fallbackLink = contentLinksLocal.find(
    (link) => link.asset_id === assetId
  );
  if (!fallbackLink?.audio) return null;

  for (const value of fallbackLink.audio) {
    if (value.startsWith('local/')) {
      const uri = await getLocalAttachmentUriWithOPFS(value);
      if (await fileExists(uri)) return uri;
    } else if (value.startsWith('file://')) {
      if (await fileExists(value)) return value;
    }
  }
  return null;
}

/**
 * Parse trim metadata from a content link's metadata column.
 * Until the DB migration adds the metadata column to asset_content_link,
 * this will return undefined.
 */
function parseTrimMetadata(
  contentLink: { metadata?: string | null }
): { startMs: number; endMs: number } | undefined {
  if (!contentLink.metadata) return undefined;
  try {
    const parsed = JSON.parse(contentLink.metadata) as {
      trim?: { startMs: number; endMs: number };
    };
    if (
      parsed.trim &&
      typeof parsed.trim.startMs === 'number' &&
      typeof parsed.trim.endMs === 'number'
    ) {
      return parsed.trim;
    }
  } catch {
    // Invalid JSON; ignore
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Core: resolve
// ---------------------------------------------------------------------------

/**
 * Resolve an asset's audio into an AssetAudio object.
 * Queries both synced and local content link tables, resolves each audio
 * value to a verified local URI, loads durations, and reads trim metadata.
 *
 * @returns AssetAudio with populated segments, or null if no audio is found.
 */
export async function resolveAssetAudio(
  assetId: string
): Promise<AssetAudio | null> {
  // Query content links from synced and local tables
  const syncedTable = resolveTable('asset_content_link', {
    localOverride: false
  });
  const localTable = resolveTable('asset_content_link', {
    localOverride: true
  });

  const contentLinksSynced = await system.db
    .select()
    .from(syncedTable)
    .where(eq(syncedTable.asset_id, assetId));
  const contentLinksLocal = await system.db
    .select()
    .from(localTable)
    .where(eq(localTable.asset_id, assetId));

  // Merge and deduplicate (synced wins)
  const allLinks = [...contentLinksSynced, ...contentLinksLocal];
  const seenIds = new Set<string>();
  const uniqueLinks = allLinks.filter((link) => {
    if (seenIds.has(link.id)) return false;
    seenIds.add(link.id);
    return true;
  });

  if (uniqueLinks.length === 0) return null;

  // Build segments: one per audio value across all content links
  // Process sequentially to avoid ExoPlayer threading issues on Android
  const segments: AssetAudioSegment[] = [];

  for (const link of uniqueLinks) {
    const audioArray = link.audio ?? [];
    if (audioArray.length === 0) continue;

    // Read trim metadata from this content link row
    const trim = parseTrimMetadata(link as { metadata?: string | null });

    for (const audioValue of audioArray) {
      if (!audioValue) continue;

      const uri = await resolveAudioValue(
        audioValue,
        contentLinksLocal as {
          asset_id: string;
          audio: string[] | null;
        }[],
        assetId
      );
      if (!uri) continue;

      const durationMs = await loadDuration(uri);

      segments.push({
        uri,
        durationMs,
        trim,
        contentLinkId: link.id
      });
    }
  }

  if (segments.length === 0) return null;

  return {
    assetId,
    segments,
    totalDurationMs: computeTotalDuration(segments)
  };
}

// ---------------------------------------------------------------------------
// Waveform
// ---------------------------------------------------------------------------

/**
 * Build a combined waveform for an asset's audio.
 *
 * By default, slices to the effective (trimmed) region of each segment.
 * Pass `ignoreTrim: true` to get the full waveform for the entire
 * underlying audio (used in the trim UI).
 */
export async function getAssetWaveform(
  assetId: string,
  options?: { barCount?: number; ignoreTrim?: boolean }
): Promise<number[]> {
  const barCount = options?.barCount ?? 128;
  const ignoreTrim = options?.ignoreTrim ?? false;

  const audio = await resolveAssetAudio(assetId);
  if (!audio || audio.segments.length === 0) return [];

  // Calculate the total duration we're representing
  const totalDuration = ignoreTrim
    ? audio.segments.reduce((sum, seg) => sum + seg.durationMs, 0)
    : audio.totalDurationMs;

  if (totalDuration <= 0) return [];

  // Single segment, no trim to worry about
  if (audio.segments.length === 1 && (ignoreTrim || !audio.segments[0]!.trim)) {
    return extractWaveformFromFile(audio.segments[0]!.uri, barCount, {
      normalize: true
    });
  }

  // Multiple segments (or trimmed single segment): build proportional waveform
  const merged: number[] = [];
  let remainingBars = barCount;
  let remainingWeight = totalDuration;

  for (let i = 0; i < audio.segments.length; i++) {
    const seg = audio.segments[i]!;
    const segDuration = ignoreTrim ? seg.durationMs : effectiveDuration(seg);
    if (segDuration <= 0) continue;

    const isLast = i === audio.segments.length - 1;
    let bars = isLast
      ? remainingBars
      : Math.max(
          1,
          Math.round((remainingBars * segDuration) / remainingWeight)
        );

    // Ensure we leave at least 1 bar per remaining segment
    const clipsLeft = audio.segments.length - i;
    bars = Math.min(bars, Math.max(1, remainingBars - (clipsLeft - 1)));

    // Extract waveform for this segment
    const segWaveform = await extractWaveformFromFile(seg.uri, bars, {
      normalize: false
    });

    // If trimmed and not ignoring, slice the waveform to the trim region
    if (!ignoreTrim && seg.trim && seg.durationMs > 0) {
      const startFrac = seg.trim.startMs / seg.durationMs;
      const endFrac = seg.trim.endMs / seg.durationMs;
      const startBar = Math.floor(startFrac * segWaveform.length);
      const endBar = Math.ceil(endFrac * segWaveform.length);
      merged.push(...segWaveform.slice(startBar, endBar));
    } else {
      merged.push(...segWaveform);
    }

    remainingBars -= bars;
    remainingWeight -= segDuration;
  }

  // Normalize the combined waveform
  const maxAmplitude = Math.max(...merged);
  if (maxAmplitude > 0) {
    for (let i = 0; i < merged.length; i++) {
      merged[i] = merged[i]! / maxAmplitude;
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Concatenate an asset's audio segments (with trim applied) into a single
 * .m4a file and return the path. Delegates to the native audio-concat module.
 *
 * TODO: Wire up to react-native-audio-concat with trim offsets.
 * For now, this is a placeholder that mirrors localAudioConcat.ts structure.
 */
export function exportAssetAudio(
  _assetId: string
): Promise<string> {
  // const audio = await resolveAssetAudio(assetId);
  // if (!audio) throw new Error('No audio found for asset');
  //
  // 1. For each segment, apply trim (convert to temp .m4a if needed)
  // 2. Concatenate via concatAudioFiles
  // 3. Return output path
  throw new Error('exportAssetAudio not yet implemented');
}

// ---------------------------------------------------------------------------
// Trim persistence
// ---------------------------------------------------------------------------

/**
 * Write each segment's trim points back to the asset_content_link metadata
 * column in the database.
 *
 * Only updates local-only content links (synced content is immutable).
 *
 * NOTE: Requires the `metadata` column on `asset_content_link`. If the column
 * does not exist yet (migration pending), the update will throw. The outer
 * try/catch ensures the function degrades to a no-op in that case.
 */
export async function saveTrim(audio: AssetAudio): Promise<void> {
  const localTable = resolveTable('asset_content_link', {
    localOverride: true
  });
  const syncedTable = resolveTable('asset_content_link', {
    localOverride: false
  });

  for (const seg of audio.segments) {
    try {
      // Only update local content links
      const syncedRow = await system.db
        .select({ id: syncedTable.id })
        .from(syncedTable)
        .where(eq(syncedTable.id, seg.contentLinkId))
        .limit(1);

      if (syncedRow.length > 0) {
        // Synced content is immutable; skip
        continue;
      }

      // Read existing metadata and merge in the trim
      const existing = await system.db
        .select()
        .from(localTable)
        .where(eq(localTable.id, seg.contentLinkId))
        .limit(1);

      if (existing.length === 0) continue;

      const row = existing[0] as { metadata?: string | null };
      let metadata: Record<string, unknown> = {};
      if (row.metadata) {
        try {
          metadata = JSON.parse(row.metadata) as Record<string, unknown>;
        } catch {
          // Invalid JSON; start fresh
        }
      }

      if (seg.trim) {
        metadata.trim = { startMs: seg.trim.startMs, endMs: seg.trim.endMs };
      } else {
        delete metadata.trim;
      }

      const metadataStr =
        Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;

      await system.db
        .update(localTable)
        .set({ metadata: metadataStr } as Record<string, unknown>)
        .where(eq(localTable.id, seg.contentLinkId));
    } catch (error) {
      console.warn(
        `saveTrim: failed to update content link ${seg.contentLinkId}:`,
        error
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Trim-aware playback (used by play() for trimmed segments)
// ---------------------------------------------------------------------------

/**
 * Convert AssetAudio segments into AudioSegment[] for AudioContext.
 * Maps trim points to startMs/endMs. Segments without trim pass through
 * as plain URIs with no offsets.
 */
function toAudioSegments(audio: AssetAudio): AudioSegment[] {
  return audio.segments.map((seg) => ({
    uri: seg.uri,
    startMs: seg.trim?.startMs,
    endMs: seg.trim?.endMs
  }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for asset audio operations.
 *
 * Provides play, stop, resolve, getWaveform, export, saveTrim, and
 * playback state. This is the main entry point for components.
 *
 * @example
 * const audio = useAssetAudio();
 * await audio.play(assetId);
 * await audio.stop();
 * const waveform = await audio.getWaveform(assetId, { barCount: 64 });
 */
export function useAssetAudio() {
  const ctx = useAudio();

  const play = async (input: string | AssetAudio): Promise<void> => {
    const audio =
      typeof input === 'string' ? await resolveAssetAudio(input) : input;
    if (!audio || audio.segments.length === 0) return;

    // Convert to AudioSegments (with startMs/endMs from trim) and
    // hand off to AudioContext. Single or multi, trimmed or not —
    // playSoundSequence handles all cases uniformly.
    const segments = toAudioSegments(audio);
    if (segments.length === 1 && !segments[0]!.startMs && !segments[0]!.endMs) {
      // Simple single untrimmed file — use playSound for least overhead
      await ctx.playSound(segments[0]!.uri, audio.assetId);
    } else {
      await ctx.playSoundSequence(segments, audio.assetId);
    }
  };

  return {
    /** Play an asset by ID, or play a pre-resolved AssetAudio object. */
    play,
    /** Stop current playback. */
    stop: ctx.stopCurrentSound,
    /** Resolve an asset's audio into an AssetAudio object. */
    resolve: resolveAssetAudio,
    /** Build a combined waveform for an asset. */
    getWaveform: getAssetWaveform,
    /** Export an asset's audio as a single .m4a file. */
    export: exportAssetAudio,
    /** Persist trim points from an AssetAudio object to the database. */
    saveTrim,

    // Playback state
    /** True while audio is playing. */
    isPlaying: ctx.isPlaying,
    /** The asset ID currently playing, or null. */
    currentAudioId: ctx.currentAudioId,
    /** Playback position in ms (Reanimated SharedValue, 60fps). */
    positionShared: ctx.positionShared,
    /** Playback duration in ms (Reanimated SharedValue). */
    durationShared: ctx.durationShared
  };
}
