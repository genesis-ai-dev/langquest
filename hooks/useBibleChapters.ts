import { system } from '@/db/powersync/system';
import { normalizeUuid } from '@/utils/uuidUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useQuery } from '@tanstack/react-query';
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

/**
 * Fetches chapter quests using metadata field from local database
 * NOTE: Uses union views (quest) that combine local + synced tables
 * USES: metadata.bible.book and metadata.bible.chapter for identification
 */
async function fetchLocalChapters(
    projectId: string,
    bookId: string
): Promise<QuestWithMetadata[]> {
    console.log(
        `[fetchLocalChapters] Querying for projectId: ${projectId}, bookId: ${bookId}`
    );

    // Query using metadata JSON field
    // NOTE: metadata is stored as JSON text, so we use json() to parse once
    // Then json_extract to get the nested bible.book and bible.chapter values
    const rawQuery = `
    SELECT 
      q.id as quest_id,
      q.name as quest_name,
      q.source as quest_source,
      q.created_at as quest_created_at,
      q.download_profiles as quest_download_profiles,
      CAST(json_extract(json(q.metadata), '$.bible.chapter') AS INTEGER) as chapter_number
    FROM quest q
    WHERE q.project_id = ?
      AND json_extract(json(q.metadata), '$.bible.book') = ?
      AND json_extract(json(q.metadata), '$.bible.chapter') IS NOT NULL
  `;

    const result = await system.powersync.execute(rawQuery, [
        projectId,
        bookId
    ]);

    console.log(`[fetchLocalChapters] Query returned ${result.rows?.length || 0} rows`);

    // Convert SQLite result to array of objects
    const questResults: QuestWithMetadata[] = [];
    if (result.rows) {
        for (let i = 0; i < result.rows.length; i++) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const row = result.rows.item(i);
            if (row) {
                // Parse download_profiles (stored as JSON)
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                const downloadProfiles = row.quest_download_profiles;
                let parsedDownloadProfiles: string[] | null = null;

                if (downloadProfiles) {
                    try {
                        if (typeof downloadProfiles === 'string') {
                            parsedDownloadProfiles = JSON.parse(downloadProfiles) as string[];
                        } else if (Array.isArray(downloadProfiles)) {
                            parsedDownloadProfiles = downloadProfiles as string[];
                        }
                    } catch (e) {
                        console.warn('Failed to parse download_profiles:', e);
                    }
                }

                questResults.push({
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    quest_id: row.quest_id as string,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    quest_name: row.quest_name as string,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    quest_source: row.quest_source as HybridDataSource,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    quest_created_at: row.quest_created_at as string,
                    quest_download_profiles: parsedDownloadProfiles,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    chapter_number: row.chapter_number as number | null
                });
            }
        }
    }

    console.log(`[fetchLocalChapters] Found ${questResults.length} chapter quests`);
    return questResults;
}

/**
 * Fetches chapter quests from Supabase cloud using metadata field
 */
async function fetchCloudChapters(
    projectId: string,
    bookId: string
): Promise<QuestWithMetadata[]> {
    console.log(`[fetchCloudChapters] Fetching from Supabase for projectId: ${projectId}, bookId: ${bookId}`);

    try {
        // In Supabase, metadata is stored as a JSON string (not JSONB object)
        // So we can't use JSONB operators directly. Instead, fetch all quests and filter in JS
        const { data, error } = await system.supabaseConnector.client
            .from('quest')
            .select('id, name, created_at, download_profiles, metadata')
            .eq('project_id', projectId)
            .not('metadata', 'is', null)
            .overrideTypes<{
                id: string;
                name: string;
                created_at: string;
                download_profiles: string[] | null;
                metadata: string | { bible?: { book: string; chapter: number } } | null;
            }[]>();

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
                    metadata = typeof parsed === 'string'
                        ? JSON.parse(parsed) as { bible?: { book: string; chapter?: number } }
                        : parsed as { bible?: { book: string; chapter?: number } };
                } else {
                    metadata = quest.metadata as { bible?: { book: string; chapter?: number } };
                }

                // Filter for matching book with chapter
                if (metadata.bible?.book === bookId && metadata.bible.chapter !== undefined) {
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

        console.log(`[fetchCloudChapters] Found ${results.length} cloud chapters out of ${data.length} quests`);
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

        // Priority logic for handling duplicates:
        // 1. Prefer synced over local/cloud
        // 2. If same source, prefer newer created_at
        const shouldReplace =
            !existing ||
            (q.quest_source === 'synced' &&
                existing.sources.has('local') &&
                !existing.sources.has('synced')) ||
            (q.quest_source === existing.sources.values().next().value &&
                q.quest_created_at > existing.created_at);

        if (shouldReplace) {
            // Replace with this record (better priority)
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
 * HYBRID: Shows local data immediately, then lazily fetches cloud data in background
 */
export function useBibleChapters(projectId: string, bookId: string) {
    const isOnline = useNetworkStatus();

    // First query: Local data only (fast)
    const {
        data: localChapters = [],
        isLoading: isLoadingLocal,
        error: localError
    } = useQuery({
        queryKey: ['bible-chapters', 'local', projectId, bookId],
        queryFn: async () => {
            const localResults = await fetchLocalChapters(projectId, bookId);
            return processChapterResults(localResults);
        },
        enabled: !!projectId && !!bookId,
        staleTime: 30000 // Cache for 30 seconds
    });

    // Second query: Cloud data (lazy, runs after local)
    const {
        data: cloudChapters = [],
        isLoading: isLoadingCloud
    } = useQuery({
        queryKey: ['bible-chapters', 'cloud', projectId, bookId],
        queryFn: async () => {
            const cloudResults = await fetchCloudChapters(projectId, bookId);
            return processChapterResults(cloudResults);
        },
        enabled: !!projectId && !!bookId && isOnline && !isLoadingLocal,
        staleTime: 60000 // Cache for 1 minute
    });

    // Merge local and cloud results, deduplicating
    const chapters = React.useMemo(() => {
        const allResults: QuestWithMetadata[] = [];

        // Convert BibleChapter back to QuestWithMetadata for processing
        for (const ch of localChapters) {
            allResults.push({
                quest_id: ch.id,
                quest_name: ch.name,
                quest_source: ch.source,
                quest_created_at: '',
                quest_download_profiles: ch.download_profiles ?? null,
                chapter_number: ch.chapterNumber
            });
        }

        for (const ch of cloudChapters) {
            allResults.push({
                quest_id: ch.id,
                quest_name: ch.name,
                quest_source: ch.source,
                quest_created_at: '',
                quest_download_profiles: ch.download_profiles ?? null,
                chapter_number: ch.chapterNumber
            });
        }

        return processChapterResults(allResults);
    }, [localChapters, cloudChapters]);

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
