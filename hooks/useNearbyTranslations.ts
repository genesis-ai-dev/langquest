import {
  asset,
  asset_content_link,
  quest,
  quest_asset_link,
  vote
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery as usePowerSyncQuery } from '@powersync/tanstack-react-query';
import { useQuery } from '@tanstack/react-query';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import React from 'react';

export interface TranslationExample {
  source: string;
  target: string;
  similarityScore?: number;
}

/**
 * Fetches contextually relevant translations from the same project for use as
 * examples in AI translation prediction.
 *
 * Online + sourceText: ranked RPC results.
 * Otherwise (and as fallback): local SQLite, watched via PowerSync.
 */
const MAX_EXAMPLES = 30;
const DISABLED_WATCH = 'SELECT 1 WHERE 0';

interface LocalTranslationRow {
  sourceAssetId: string | null;
  translationText: string | null;
  createdAt: string;
  upvoteCount: number;
  sourceText: string | null;
  inCurrentQuest: number | null;
}

function pickLocalExamples(rows: LocalTranslationRow[]): TranslationExample[] {
  const bestBySource = new Map<string, LocalTranslationRow>();

  for (const row of rows) {
    if (!row.sourceAssetId || !row.translationText) continue;

    const existing = bestBySource.get(row.sourceAssetId);
    if (!existing) {
      bestBySource.set(row.sourceAssetId, row);
      continue;
    }

    const existingUpvotes = Number(existing.upvoteCount) || 0;
    const currentUpvotes = Number(row.upvoteCount) || 0;
    if (currentUpvotes > existingUpvotes) {
      bestBySource.set(row.sourceAssetId, row);
    } else if (currentUpvotes === existingUpvotes) {
      const existingDate = existing.createdAt
        ? new Date(existing.createdAt)
        : new Date(0);
      const currentDate = row.createdAt ? new Date(row.createdAt) : new Date(0);
      if (currentDate > existingDate) {
        bestBySource.set(row.sourceAssetId, row);
      }
    }
  }

  const currentQuest: TranslationExample[] = [];
  const others: TranslationExample[] = [];

  for (const row of bestBySource.values()) {
    const sourceText = row.sourceText?.trim();
    const target = row.translationText?.trim();
    if (!sourceText || !target) continue;
    const example = { source: sourceText, target };
    if (row.inCurrentQuest) currentQuest.push(example);
    else others.push(example);
  }

  return [...currentQuest, ...others].slice(0, MAX_EXAMPLES);
}

export function useNearbyTranslations(
  questId: string | null | undefined,
  targetLanguageId: string,
  sourceText?: string | null
) {
  const isOnline = useNetworkStatus();
  const watch =
    !!questId &&
    !!targetLanguageId &&
    questId !== '' &&
    targetLanguageId !== '';
  const trimmedSource = sourceText?.trim() ?? '';
  const rpcEnabled = watch && isOnline && trimmedSource.length > 0;

  const localQuery = usePowerSyncQuery<LocalTranslationRow>({
    queryKey: [
      'nearby-translations',
      'offline',
      questId ?? '',
      targetLanguageId
    ],
    query: watch
      ? toCompilableQuery(
          system.db
            .select({
              sourceAssetId: asset.source_asset_id,
              translationText: asset_content_link.text,
              createdAt: asset.created_at,
              upvoteCount: sql<number>`COALESCE(
                SUM(
                  CASE
                    WHEN ${vote.polarity} = 'up' AND ${vote.active} = 1 THEN 1
                    ELSE 0
                  END
                ),
                0
              )`.as('upvote_count'),
              sourceText: sql<string | null>`(
                SELECT ${asset_content_link.text}
                FROM ${asset_content_link}
                WHERE ${asset_content_link.asset_id} = ${asset.source_asset_id}
                  AND ${asset_content_link.active} = 1
                  AND ${asset_content_link.text} IS NOT NULL
                LIMIT 1
              )`,
              inCurrentQuest: sql<number | null>`(
                SELECT 1
                FROM ${quest_asset_link}
                WHERE ${quest_asset_link.asset_id} = ${asset.source_asset_id}
                  AND ${quest_asset_link.quest_id} = ${questId}
                  AND ${quest_asset_link.active} = 1
                LIMIT 1
              )`
            })
            .from(asset)
            .innerJoin(
              asset_content_link,
              eq(asset_content_link.asset_id, asset.id)
            )
            .leftJoin(vote, eq(vote.asset_id, asset.id))
            .where(
              and(
                isNotNull(asset.source_asset_id),
                eq(asset.source_language_id, targetLanguageId),
                eq(asset.active, true),
                isNotNull(asset_content_link.text),
                eq(
                  asset.project_id,
                  sql`(SELECT ${quest.project_id} FROM ${quest} WHERE ${quest.id} = ${questId})`
                )
              )
            )
            .groupBy(
              asset.id,
              asset.source_asset_id,
              asset_content_link.id,
              asset_content_link.text,
              asset.created_at
            )
        )
      : DISABLED_WATCH
  });

  const localExamples = React.useMemo(
    () => pickLocalExamples(localQuery.data ?? []),
    [localQuery.data]
  );

  const rpcQuery = useQuery<TranslationExample[]>({
    queryKey: [
      'nearby-translations',
      'cloud',
      questId ?? '',
      targetLanguageId,
      trimmedSource
    ],
    queryFn: async () => {
      if (!questId) return [];

      const currentQuest = await system.db
        .select({ projectId: quest.project_id })
        .from(quest)
        .where(eq(quest.id, questId))
        .limit(1)
        .then((results) => results[0]);

      if (!currentQuest) return [];

      const rpcResult = await system.supabaseConnector.client.rpc(
        'get_similar_translations',
        {
          p_project_id: currentQuest.projectId,
          p_target_language_id: targetLanguageId,
          p_source_text: trimmedSource,
          p_limit: MAX_EXAMPLES
        }
      );

      if (rpcResult.error) {
        console.error('[useNearbyTranslations] RPC error:', rpcResult.error);
        return [];
      }

      const rpcExamples = rpcResult.data as
        | {
            source_text: string;
            target_text: string;
            similarity_score: number;
          }[]
        | null;

      return (rpcExamples ?? []).map((example) => ({
        source: example.source_text,
        target: example.target_text,
        similarityScore: example.similarity_score
      }));
    },
    enabled: rpcEnabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });

  const rpcExamples = rpcQuery.data;
  const data =
    rpcExamples && rpcExamples.length > 0 ? rpcExamples : localExamples;

  return {
    data,
    isLoading:
      (watch && localQuery.isLoading && !localExamples.length) ||
      (rpcEnabled && rpcQuery.isLoading && !rpcExamples?.length),
    isFetching: localQuery.isFetching || rpcQuery.isFetching,
    error: localQuery.error ?? rpcQuery.error
  };
}
