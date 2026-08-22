import { system } from '@/db/powersync/system';
import React from 'react';

export interface UploadCategoryProgress {
  total: number;
  confirmed: number;
}

export interface QuestUploadBreakdown {
  /** The quest row itself. */
  quest: UploadCategoryProgress;
  /** quest_asset_link rows. */
  questAssetLinks: UploadCategoryProgress;
  /** asset rows. */
  assets: UploadCategoryProgress;
  /** asset_content_link rows. */
  contentLinks: UploadCategoryProgress;
  /** Content links with audio, confirmed via audio_uploaded_at. */
  audio: UploadCategoryProgress;
}

export interface QuestUploadProgress {
  /** Total published records being tracked (quest, links, assets, content). */
  totalRecords: number;
  /** Records the server has confirmed via uploaded_at. */
  confirmedRecords: number;
  /** Total content links that reference an audio file. */
  totalAudio: number;
  /** Audio files the server has confirmed via audio_uploaded_at. */
  confirmedAudio: number;
  /** Combined records + audio percent (0-100). */
  percent: number;
  /** Per-table breakdown for the details drawer. */
  breakdown: QuestUploadBreakdown;
  /** True once there is something published and everything is confirmed. */
  isComplete: boolean;
  /** True while at least one record or audio file is still unconfirmed. */
  isPending: boolean;
  /** True when nothing has been published for this quest yet. */
  isEmpty: boolean;
}

interface CountsRow {
  quest_total: number;
  quest_confirmed: number;
  qal_total: number;
  qal_confirmed: number;
  asset_total: number;
  asset_confirmed: number;
  acl_total: number;
  acl_confirmed: number;
  audio_total: number;
  audio_confirmed: number;
}

const EMPTY_BREAKDOWN: QuestUploadBreakdown = {
  quest: { total: 0, confirmed: 0 },
  questAssetLinks: { total: 0, confirmed: 0 },
  assets: { total: 0, confirmed: 0 },
  contentLinks: { total: 0, confirmed: 0 },
  audio: { total: 0, confirmed: 0 }
};

const EMPTY: QuestUploadProgress = {
  totalRecords: 0,
  confirmedRecords: 0,
  totalAudio: 0,
  confirmedAudio: 0,
  percent: 0,
  breakdown: EMPTY_BREAKDOWN,
  isComplete: false,
  isPending: false,
  isEmpty: true
};

// Only the spline tables that carry uploaded_at are counted (quest, quest_asset_link,
// asset, asset_content_link). Tag-link tables have no uploaded_at column. Published
// records live in the *_synced tables, which is exactly what an upload flushes.
const COUNTS_SQL = `
WITH aset AS (
  SELECT asset_id FROM quest_asset_link_synced WHERE quest_id = ?
)
SELECT
  (SELECT COUNT(*) FROM quest_synced WHERE id = ?) AS quest_total,
  (SELECT COUNT(*) FROM quest_synced WHERE id = ? AND uploaded_at IS NOT NULL)
    AS quest_confirmed,
  (SELECT COUNT(*) FROM quest_asset_link_synced WHERE quest_id = ?) AS qal_total,
  (SELECT COUNT(*) FROM quest_asset_link_synced WHERE quest_id = ? AND uploaded_at IS NOT NULL)
    AS qal_confirmed,
  (SELECT COUNT(*) FROM asset_synced WHERE id IN (SELECT asset_id FROM aset)) AS asset_total,
  (SELECT COUNT(*) FROM asset_synced WHERE id IN (SELECT asset_id FROM aset) AND uploaded_at IS NOT NULL)
    AS asset_confirmed,
  (SELECT COUNT(*) FROM asset_content_link_synced WHERE asset_id IN (SELECT asset_id FROM aset))
    AS acl_total,
  (SELECT COUNT(*) FROM asset_content_link_synced WHERE asset_id IN (SELECT asset_id FROM aset) AND uploaded_at IS NOT NULL)
    AS acl_confirmed,
  (SELECT COUNT(*) FROM asset_content_link_synced
     WHERE asset_id IN (SELECT asset_id FROM aset)
       AND audio IS NOT NULL AND audio != '[]' AND audio != '') AS audio_total,
  (SELECT COUNT(*) FROM asset_content_link_synced
     WHERE asset_id IN (SELECT asset_id FROM aset)
       AND audio IS NOT NULL AND audio != '[]' AND audio != ''
       AND audio_uploaded_at IS NOT NULL) AS audio_confirmed
`;

const PARAM_COUNT = 5;

function toProgress(row: CountsRow | undefined): QuestUploadProgress {
  if (!row) return EMPTY;

  const breakdown: QuestUploadBreakdown = {
    quest: { total: row.quest_total ?? 0, confirmed: row.quest_confirmed ?? 0 },
    questAssetLinks: {
      total: row.qal_total ?? 0,
      confirmed: row.qal_confirmed ?? 0
    },
    assets: {
      total: row.asset_total ?? 0,
      confirmed: row.asset_confirmed ?? 0
    },
    contentLinks: {
      total: row.acl_total ?? 0,
      confirmed: row.acl_confirmed ?? 0
    },
    audio: { total: row.audio_total ?? 0, confirmed: row.audio_confirmed ?? 0 }
  };

  const totalRecords =
    breakdown.quest.total +
    breakdown.questAssetLinks.total +
    breakdown.assets.total +
    breakdown.contentLinks.total;
  const confirmedRecords =
    breakdown.quest.confirmed +
    breakdown.questAssetLinks.confirmed +
    breakdown.assets.confirmed +
    breakdown.contentLinks.confirmed;
  const totalAudio = breakdown.audio.total;
  const confirmedAudio = breakdown.audio.confirmed;

  const total = totalRecords + totalAudio;
  const confirmed = confirmedRecords + confirmedAudio;

  if (total === 0) return EMPTY;

  // Never display 100% while something is still pending (rounding can hit 100
  // at e.g. 995/1000); 100 is reserved for fully confirmed.
  const percent =
    confirmed >= total
      ? 100
      : Math.min(99, Math.round((confirmed / total) * 100));

  return {
    totalRecords,
    confirmedRecords,
    totalAudio,
    confirmedAudio,
    percent,
    breakdown,
    isComplete: confirmed >= total,
    isPending: confirmed < total,
    isEmpty: false
  };
}

/**
 * Live upload-confirmation progress for a published quest.
 *
 * Counts the quest's synced spline records (confirmed via uploaded_at) and its
 * audio files (confirmed via audio_uploaded_at) and returns a combined percent
 * plus a per-table breakdown. Both signals are stamped server-side and synced
 * back down, so watching the local SQLite *_synced tables reflects real server
 * confirmation, not just the optimistic "queued" state at publish time.
 */
export function useQuestUploadProgress(
  questId: string | null | undefined
): QuestUploadProgress {
  const [progress, setProgress] = React.useState<QuestUploadProgress>(EMPTY);

  React.useEffect(() => {
    if (!questId) {
      setProgress(EMPTY);
      return;
    }

    const abortController = new AbortController();
    let isMounted = true;
    const shouldProceed = () => !abortController.signal.aborted && isMounted;
    const params = Array(PARAM_COUNT).fill(questId) as string[];

    // watch() fires onResult immediately with the initial query result, so no
    // separate initial fetch is needed.
    system.powersync.watch(
      COUNTS_SQL,
      params,
      {
        onResult: (result) => {
          if (!shouldProceed()) return;
          const row = result.rows?._array?.[0] as CountsRow | undefined;
          setProgress(toProgress(row));
        },
        onError: (err) => {
          if (!shouldProceed()) return;
          console.error('Quest upload progress watch error:', err);
        }
      },
      { signal: abortController.signal }
    );

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [questId]);

  return progress;
}
