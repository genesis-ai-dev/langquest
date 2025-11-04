import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { normalizeUuid } from '@/utils/uuidUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import React from 'react';
import { useNetworkStatus } from './useNetworkStatus';

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
 * Fetches chapter quests using metadata field from local database
 * NOTE: Uses Drizzle ORM to query the merged quest view (includes quest_local + quest_synced)
 * This ensures local-only chapters created offline are included
 * USES: metadata.bible.book and metadata.bible.chapter for identification
 */
async function fetchLocalChapters(
  projectId: string,
  bookId: string
): Promise<QuestWithMetadata[]> {
  console.log(
    `[fetchLocalChapters] Querying for projectId: ${projectId}, bookId: ${bookId}`
  );

  // Use Drizzle ORM relational query API to query the merged quest view
  // This ensures local-only chapters created offline are included
  // Query all quests matching the criteria, then filter and transform
  const allQuests = await system.db.query.quest.findMany({
    where: eq(quest.project_id, projectId),
    columns: {
      id: true,
      name: true,
      source: true,
      created_at: true,
      download_profiles: true,
      metadata: true
    }
  });

  // Filter for chapters matching the bookId (have bible.chapter)
  // Note: We filter in JS because Drizzle's query builder doesn't handle JSON extraction well
  // This approach ensures we get all records including local-only ones
  const results = allQuests
    .filter((q) => {
      if (!q.metadata) return false;

      const metadata: BibleMetadata =
        typeof q.metadata === 'string'
          ? (JSON.parse(q.metadata) as BibleMetadata)
          : (q.metadata as BibleMetadata);

      const bibleBook = metadata?.bible?.book;
      const bibleChapter = metadata?.bible?.chapter;

      return bibleBook === bookId && bibleChapter != null;
    })
    .map((q) => {
      const metadata: BibleMetadata =
        typeof q.metadata === 'string'
          ? (JSON.parse(q.metadata) as BibleMetadata)
          : (q.metadata as BibleMetadata);

      return {
        quest_id: q.id,
        quest_name: q.name,
        quest_source: q.source,
        quest_created_at: q.created_at,
        quest_download_profiles: q.download_profiles,
        chapter_number: metadata?.bible?.chapter! || null
      };
    });

  console.log(
    `[fetchLocalChapters] Query returned ${results.length} rows for projectId: ${projectId}, bookId: ${bookId}`
  );

  // Convert Drizzle results to QuestWithMetadata format
  // download_profiles is already parsed by Drizzle (text mode: 'json')
  const questResults: QuestWithMetadata[] = results.map((row) => {
    // Parse download_profiles (stored as JSON)
    let parsedDownloadProfiles: string[] | null = null;
    const downloadProfiles = row.quest_download_profiles;

    if (downloadProfiles) {
      try {
        if (typeof downloadProfiles === 'string') {
          parsedDownloadProfiles = JSON.parse(downloadProfiles) as string[];
        } else if (Array.isArray(downloadProfiles)) {
          parsedDownloadProfiles = downloadProfiles;
        }
      } catch (e) {
        console.warn('Failed to parse download_profiles:', e);
      }
    }

    // Handle created_at - could be Date, string, or null
    let createdAt: string;
    const createdAtValue = row.quest_created_at;
    if (
      createdAtValue &&
      typeof createdAtValue === 'object' &&
      'toISOString' in createdAtValue
    ) {
      createdAt = (createdAtValue as Date).toISOString();
    } else if (typeof createdAtValue === 'string') {
      createdAt = createdAtValue;
    } else {
      createdAt = new Date().toISOString();
    }

    return {
      quest_id: row.quest_id,
      quest_name: row.quest_name,
      quest_source: row.quest_source,
      quest_created_at: createdAt,
      quest_download_profiles: parsedDownloadProfiles,
      chapter_number: row.chapter_number
    };
  });

  console.log(
    `[fetchLocalChapters] Processed ${questResults.length} chapter quests:`,
    questResults.map((r) => ({
      id: r.quest_id.slice(0, 8),
      name: r.quest_name,
      chapter: r.chapter_number,
      source: r.quest_source
    }))
  );
  return questResults;
}

/**
 * Fetches chapter quests from Supabase cloud using metadata field
 */
async function fetchCloudChapters(
  projectId: string,
  bookId: string
): Promise<QuestWithMetadata[]> {
  console.log(
    `[fetchCloudChapters] Fetching from Supabase for projectId: ${projectId}, bookId: ${bookId}`
  );

  try {
    // In Supabase, metadata is stored as a JSON string (not JSONB object)
    // So we can't use JSONB operators directly. Instead, fetch all quests and filter in JS
    const { data, error } = await system.supabaseConnector.client
      .from('quest')
      .select('id, name, created_at, download_profiles, metadata')
      .eq('project_id', projectId)
      .not('metadata', 'is', null)
      .overrideTypes<
        {
          id: string;
          name: string;
          created_at: string;
          download_profiles: string[] | null;
          metadata:
            | string
            | { bible?: { book: string; chapter: number } }
            | null;
        }[]
      >();

    if (error) {
      console.error('[fetchCloudChapters] Supabase error:', error);
      return [];
    }

    if (data.length === 0) {
      console.log('[fetchCloudChapters] No quests found in cloud for project');
      return [];
    }

    // Parse metadata and filter for matching book chapters
    const results: QuestWithMetadata[] = [];
    for (const quest of data) {
      if (!quest.metadata) continue;

      try {
        // Handle double-encoded JSON (stored as string)
        let metadata: { bible?: { book: string; chapter?: number } };
        if (typeof quest.metadata === 'string') {
          // Parse once to get the inner JSON string, then parse again to get the object
          const parsed: unknown = JSON.parse(quest.metadata);
          metadata =
            typeof parsed === 'string'
              ? (JSON.parse(parsed) as {
                  bible?: { book: string; chapter?: number };
                })
              : (parsed as { bible?: { book: string; chapter?: number } });
        } else {
          metadata = quest.metadata as {
            bible?: { book: string; chapter?: number };
          };
        }

        // Filter for matching book with chapter
        if (
          metadata.bible?.book === bookId &&
          metadata.bible.chapter !== undefined
        ) {
          results.push({
            quest_id: quest.id,
            quest_name: quest.name,
            quest_source: 'cloud' as HybridDataSource,
            quest_created_at: quest.created_at,
            quest_download_profiles: quest.download_profiles,
            chapter_number: metadata.bible.chapter
          });
        }
      } catch (e) {
        console.warn(`Failed to parse metadata for quest ${quest.id}:`, e);
      }
    }

    console.log(
      `[fetchCloudChapters] Found ${results.length} cloud chapters out of ${data.length} quests`
    );
    return results;
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
  const isOnline = useNetworkStatus();

  // First query: Local data only (fast) - returns raw QuestWithMetadata
  const {
    data: localResults = [],
    isLoading: isLoadingLocal,
    error: localError
  } = useQuery({
    queryKey: ['bible-chapters', 'local', projectId, bookId],
    queryFn: () => fetchLocalChapters(projectId, bookId),
    enabled: !!projectId && !!bookId,
    staleTime: 30000 // Cache for 30 seconds
  });

  // Second query: Cloud data (runs in parallel, updates UI when complete) - returns raw QuestWithMetadata
  const { data: cloudResults = [], isLoading: isLoadingCloud } = useQuery({
    queryKey: ['bible-chapters', 'cloud', projectId, bookId],
    queryFn: () => fetchCloudChapters(projectId, bookId),
    enabled: !!projectId && !!bookId && isOnline, // Removed !isLoadingLocal - let it run in parallel
    staleTime: 60000 // Cache for 1 minute
  });

  // Merge and process results once - updates immediately when either query completes
  const chapters = React.useMemo(() => {
    // Combine raw results and process once
    const allResults = [...localResults, ...cloudResults];
    return processChapterResults(allResults);
  }, [localResults, cloudResults]);

  // Get just the chapter numbers that exist
  const existingChapterNumbers = chapters.map((ch) => ch.chapterNumber);

  return {
    chapters,
    existingChapterNumbers,
    isLoading: isLoadingLocal, // Only show loading for local query
    isLoadingCloud,
    error: localError
  };
}
