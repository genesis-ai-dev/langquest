import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { normalizeUuid } from '@/utils/uuidUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, sql } from 'drizzle-orm';
import React from 'react';

export interface BibleChapter {
  id: string;
  name: string;
  chapterNumber: number;
  source: HybridDataSource;
  hasLocalCopy: boolean;
  hasSyncedCopy: boolean;
  download_profiles?: string[] | null;
}

interface QuestWithMetadata {
  quest_id: string;
  quest_name: string;
  quest_source: HybridDataSource;
  quest_created_at: string;
  quest_download_profiles: string[] | null;
  chapter_number: number | null;
}

interface BibleMetadata {
  bible?: {
    book?: string;
    chapter?: number;
  };
}

/**
 * Fetches chapter quests from Supabase cloud using metadata field.
 * Returns raw quest records — filtering/parsing is done by useHybridData's
 * transformCloudData and the post-processing step in useBibleChapters.
 */
async function fetchCloudChapters(
  projectId: string,
  bookId: string
): Promise<(typeof quest.$inferSelect)[]> {
  try {
    const { data, error } = await system.supabaseConnector.client
      .from('quest')
      .select('*')
      .eq('project_id', projectId)
      .not('metadata', 'is', null)
      .overrideTypes<(typeof quest.$inferSelect)[]>();

    if (error) throw error;
    if (!data || data.length === 0) return [];

    return data.filter((q) => {
      if (!q.metadata) return false;
      try {
        let metadata: BibleMetadata;
        if (typeof q.metadata === 'string') {
          const parsed: unknown = JSON.parse(q.metadata);
          metadata =
            typeof parsed === 'string'
              ? (JSON.parse(parsed) as BibleMetadata)
              : (parsed as BibleMetadata);
        } else {
          metadata = q.metadata as BibleMetadata;
        }
        return (
          metadata?.bible?.book === bookId &&
          metadata?.bible?.chapter !== undefined
        );
      } catch {
        return false;
      }
    });
  } catch (error) {
    console.error('[fetchCloudChapters] Exception:', error);
    return [];
  }
}

/**
 * Processes quest results with metadata into deduplicated chapter list
 */
function processChapterResults(
  questResults: QuestWithMetadata[]
): BibleChapter[] {
  if (questResults.length === 0) {
    return [];
  }

  // Group by CHAPTER NUMBER to handle duplicates
  const chapterMap = new Map<
    number,
    {
      id: string;
      name: string;
      chapterNumber: number;
      sources: Set<HybridDataSource>;
      download_profiles?: string[] | null;
      created_at: string;
    }
  >();

  for (const q of questResults) {
    if (!q.chapter_number) continue;

    const chapterNumber = q.chapter_number;
    const existing = chapterMap.get(chapterNumber);

    // Priority logic for handling duplicates: synced > local > cloud
    // Higher priority sources replace lower priority ones
    const getSourcePriority = (source: HybridDataSource): number => {
      if (source === 'synced') return 3;
      if (source === 'local') return 2;
      return 1; // cloud
    };

    if (!existing) {
      // No existing record, use this one
      chapterMap.set(chapterNumber, {
        id: q.quest_id,
        name: q.quest_name,
        chapterNumber,
        sources: new Set([q.quest_source]),
        download_profiles: q.quest_download_profiles,
        created_at: q.quest_created_at
      });
    } else if (normalizeUuid(q.quest_id) === normalizeUuid(existing.id)) {
      // Same ID in different source, add source to set
      existing.sources.add(q.quest_source);
    } else {
      // Different IDs for same chapter - check priority
      const existingPriority = Math.max(
        ...Array.from(existing.sources).map(getSourcePriority)
      );
      const newPriority = getSourcePriority(q.quest_source);

      if (newPriority > existingPriority) {
        // New record has higher priority, replace
        chapterMap.set(chapterNumber, {
          id: q.quest_id,
          name: q.quest_name,
          chapterNumber,
          sources: new Set([q.quest_source]),
          download_profiles: q.quest_download_profiles,
          created_at: q.quest_created_at
        });
      } else if (
        newPriority === existingPriority &&
        q.quest_created_at > existing.created_at
      ) {
        // Same priority, prefer newer
        chapterMap.set(chapterNumber, {
          id: q.quest_id,
          name: q.quest_name,
          chapterNumber,
          sources: new Set([q.quest_source]),
          download_profiles: q.quest_download_profiles,
          created_at: q.quest_created_at
        });
      }
      // Otherwise, keep existing (it has higher priority or is newer with same priority)
    }
  }

  const chapters = Array.from(chapterMap.values())
    .map(
      (ch): BibleChapter => ({
        id: ch.id,
        name: ch.name,
        chapterNumber: ch.chapterNumber,
        // Primary source: synced > local > cloud
        source: ch.sources.has('synced')
          ? 'synced'
          : ch.sources.has('local')
            ? 'local'
            : 'cloud',
        hasLocalCopy: ch.sources.has('local'),
        hasSyncedCopy: ch.sources.has('synced'),
        download_profiles: ch.download_profiles
      })
    )
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  return chapters;
}

/**
 * Hook to query existing chapter quests for a Bible book
 * Uses metadata.bible.book and metadata.bible.chapter for identification
 * Returns chapters with source tracking for both local and synced versions
 * LOCAL-FIRST: Shows local data immediately, fetches cloud data in parallel (background)
 * UI never blocks on cloud - only on local query
 */
export function useBibleChapters(projectId: string, bookId: string) {
  const offlineQuery = toCompilableQuery(
    system.db
      .select()
      .from(quest)
      .where(
        and(
          eq(quest.project_id, projectId),
          sql`json_extract(json(${quest.metadata}), '$.bible.book') = ${bookId}`,
          sql`json_extract(json(${quest.metadata}), '$.bible.chapter') IS NOT NULL`
        )
      )
  );

  const {
    data: rawQuests = [],
    isLoading,
    isCloudLoading,
    offlineError
  } = useHybridData({
    dataType: 'bible-chapters',
    queryKeyParams: [projectId, bookId],
    offlineQuery,
    cloudQueryFn: () => fetchCloudChapters(projectId, bookId),
    transformCloudData: (cloudQuest) => {
      let parsedMetadata: BibleMetadata | null = null;
      if (cloudQuest.metadata) {
        try {
          if (typeof cloudQuest.metadata === 'string') {
            const parsed: unknown = JSON.parse(cloudQuest.metadata);
            parsedMetadata =
              typeof parsed === 'string'
                ? (JSON.parse(parsed) as BibleMetadata)
                : (parsed as BibleMetadata);
          } else {
            parsedMetadata = cloudQuest.metadata as BibleMetadata;
          }
        } catch (e) {
          console.warn(
            `Failed to parse metadata for cloud chapter ${cloudQuest.id}:`,
            e
          );
        }
      }
      return {
        ...cloudQuest,
        metadata: parsedMetadata
      } as typeof quest.$inferSelect;
    },
    enabled: !!projectId && !!bookId
  });

  const chapters = React.useMemo(() => {
    const questResults: QuestWithMetadata[] = rawQuests
      .filter((q) => {
        if (!q.metadata) return false;
        const metadata: BibleMetadata =
          typeof q.metadata === 'string'
            ? (JSON.parse(q.metadata) as BibleMetadata)
            : (q.metadata as BibleMetadata);
        return (
          metadata?.bible?.book === bookId && metadata?.bible?.chapter != null
        );
      })
      .map((q) => {
        const metadata: BibleMetadata =
          typeof q.metadata === 'string'
            ? (JSON.parse(q.metadata) as BibleMetadata)
            : (q.metadata as BibleMetadata);
        return {
          quest_id: q.id,
          quest_name: q.name,
          quest_source: (q as { source?: HybridDataSource }).source ?? 'cloud',
          quest_created_at:
            typeof q.created_at === 'string'
              ? q.created_at
              : q.created_at instanceof Date
                ? q.created_at.toISOString()
                : new Date().toISOString(),
          quest_download_profiles: q.download_profiles,
          chapter_number: metadata?.bible?.chapter ?? null
        };
      });

    return processChapterResults(questResults);
  }, [rawQuests, bookId]);

  const existingChapterNumbers = chapters.map((ch) => ch.chapterNumber);

  return {
    chapters,
    existingChapterNumbers,
    isLoading,
    isLoadingCloud: isCloudLoading,
    error: offlineError
  };
}
