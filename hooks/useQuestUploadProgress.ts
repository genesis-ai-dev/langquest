import {
  asset,
  asset_content_link,
  quest,
  quest_asset_link
} from '@/db/drizzleSchema';
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
  /** Total records being tracked (quest, links, assets, content). */
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
  /** True once there is something to track and everything is confirmed. */
  isComplete: boolean;
  /** True while at least one record or audio file is still unconfirmed. */
  isPending: boolean;
  /** True when the quest has no records to track yet. */
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
 * Live upload-confirmation progress for a quest, draft or published.
 *
 * Counts the quest's spline records (confirmed via uploaded_at) and its
 * audio files (confirmed via audio_uploaded_at) and returns a combined percent
 * plus a per-table breakdown. Both signals are stamped server-side and synced
 * back down, so watching these rows in local SQLite reflects real server
 * confirmation, not just the optimistic "queued" state.
 *
 * Only the spline tables that carry uploaded_at are counted (quest,
 * quest_asset_link, asset, asset_content_link). Tag-link tables have no
 * uploaded_at column.
 *
 * Drafts and published quests share the same tables and are counted the same
 * way: draft rows sync and draft audio uploads at record time, so the percent
 * is a backup indicator independent of `published_at`.
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
        confirmed: sql<number>`count(*) filter (where ${quest.uploaded_at} is not null)`
      })
      .from(quest)
      .where(eq(quest.id, questId));

    const qalCounts = system.db
      .select({
        total: sql<number>`count(*)`,
        confirmed: sql<number>`count(*) filter (where ${quest_asset_link.uploaded_at} is not null)`
      })
      .from(quest_asset_link)
      .where(eq(quest_asset_link.quest_id, questId));

    const questAssetIds = system.db
      .select({ asset_id: quest_asset_link.asset_id })
      .from(quest_asset_link)
      .where(eq(quest_asset_link.quest_id, questId));

    const assetCounts = system.db
      .select({
        total: sql<number>`count(*)`,
        confirmed: sql<number>`count(*) filter (where ${asset.uploaded_at} is not null)`
      })
      .from(asset)
      .where(inArray(asset.id, questAssetIds));

    // audio is JSON-as-text in SQLite; '' / '[]' mean "no audio referenced".
    const hasAudio = sql`${asset_content_link.audio} is not null
      and ${asset_content_link.audio} != '[]'
      and ${asset_content_link.audio} != ''`;
    const aclCounts = system.db
      .select({
        total: sql<number>`count(*)`,
        confirmed: sql<number>`count(*) filter (where ${asset_content_link.uploaded_at} is not null)`,
        audio_total: sql<number>`count(*) filter (where ${hasAudio})`,
        audio_confirmed: sql<number>`count(*) filter (where ${hasAudio} and ${asset_content_link.audio_uploaded_at} is not null)`
      })
      .from(asset_content_link)
      .where(inArray(asset_content_link.asset_id, questAssetIds));

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
      // Drafts count too: their rows sync (uploaded_at) and their audio
      // uploads as soon as it is recorded (audio_uploaded_at), so the percent
      // is a real backup indicator before the user ever publishes.
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
