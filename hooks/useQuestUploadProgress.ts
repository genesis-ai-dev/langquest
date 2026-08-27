import {
  asset_content_link_synced,
  asset_synced,
  quest_asset_link_synced,
  quest_synced
} from '@/db/drizzleSchemaSynced';
import { system } from '@/db/powersync/system';
import { eq, inArray, sql } from 'drizzle-orm';
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
  total: number;
  confirmed: number;
}

interface AclCountsRow extends CountsRow {
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

function toCategory(row: CountsRow | undefined): UploadCategoryProgress {
  return { total: row?.total ?? 0, confirmed: row?.confirmed ?? 0 };
}

function toProgress(
  quest: CountsRow | undefined,
  questAssetLinks: CountsRow | undefined,
  assets: CountsRow | undefined,
  acl: AclCountsRow | undefined
): QuestUploadProgress {
  const breakdown: QuestUploadBreakdown = {
    quest: toCategory(quest),
    questAssetLinks: toCategory(questAssetLinks),
    assets: toCategory(assets),
    contentLinks: toCategory(acl),
    audio: {
      total: acl?.audio_total ?? 0,
      confirmed: acl?.audio_confirmed ?? 0
    }
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
 *
 * Only the spline tables that carry uploaded_at are counted (quest,
 * quest_asset_link, asset, asset_content_link). Tag-link tables have no
 * uploaded_at column. Published records live in the *_synced tables, which is
 * exactly what an upload flushes.
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

    // Aggregate-only queries always return exactly one row, even when the
    // quest has nothing published yet.
    const questCounts = system.db
      .select({
        total: sql<number>`count(*)`,
        confirmed: sql<number>`count(*) filter (where ${quest_synced.uploaded_at} is not null)`
      })
      .from(quest_synced)
      .where(eq(quest_synced.id, questId));

    const qalCounts = system.db
      .select({
        total: sql<number>`count(*)`,
        confirmed: sql<number>`count(*) filter (where ${quest_asset_link_synced.uploaded_at} is not null)`
      })
      .from(quest_asset_link_synced)
      .where(eq(quest_asset_link_synced.quest_id, questId));

    const questAssetIds = system.db
      .select({ asset_id: quest_asset_link_synced.asset_id })
      .from(quest_asset_link_synced)
      .where(eq(quest_asset_link_synced.quest_id, questId));

    const assetCounts = system.db
      .select({
        total: sql<number>`count(*)`,
        confirmed: sql<number>`count(*) filter (where ${asset_synced.uploaded_at} is not null)`
      })
      .from(asset_synced)
      .where(inArray(asset_synced.id, questAssetIds));

    // audio is JSON-as-text in SQLite; '' / '[]' mean "no audio referenced".
    const hasAudio = sql`${asset_content_link_synced.audio} is not null
      and ${asset_content_link_synced.audio} != '[]'
      and ${asset_content_link_synced.audio} != ''`;
    const aclCounts = system.db
      .select({
        total: sql<number>`count(*)`,
        confirmed: sql<number>`count(*) filter (where ${asset_content_link_synced.uploaded_at} is not null)`,
        audio_total: sql<number>`count(*) filter (where ${hasAudio})`,
        audio_confirmed: sql<number>`count(*) filter (where ${hasAudio} and ${asset_content_link_synced.audio_uploaded_at} is not null)`
      })
      .from(asset_content_link_synced)
      .where(inArray(asset_content_link_synced.asset_id, questAssetIds));

    // Hold partial results and only publish once every watch has reported, so
    // consumers never see a mix of fresh and missing categories.
    const rows: {
      quest?: CountsRow;
      qal?: CountsRow;
      asset?: CountsRow;
      acl?: AclCountsRow;
    } = {};

    const publish = () => {
      if (abortController.signal.aborted) return;
      if (!rows.quest || !rows.qal || !rows.asset || !rows.acl) return;
      setProgress(toProgress(rows.quest, rows.qal, rows.asset, rows.acl));
    };

    const watch = <T>(
      query: Parameters<typeof system.db.watch<T>>[0],
      assign: (row: T | undefined) => void
    ) => {
      system.db.watch<T>(
        query,
        {
          onResult: (results) => {
            assign(results[0]);
            publish();
          },
          onError: (err) => {
            if (abortController.signal.aborted) return;
            console.error('Quest upload progress watch error:', err);
          }
        },
        { signal: abortController.signal }
      );
    };

    watch<CountsRow>(questCounts, (row) => (rows.quest = row));
    watch<CountsRow>(qalCounts, (row) => (rows.qal = row));
    watch<CountsRow>(assetCounts, (row) => (rows.asset = row));
    watch<AclCountsRow>(aclCounts, (row) => (rows.acl = row));

    return () => {
      abortController.abort();
    };
  }, [questId]);

  return progress;
}
