import { system } from '@/db/powersync/system';
import { normalizeUuid } from '@/utils/uuidUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useQuery } from '@tanstack/react-query';
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

    // Query using metadata JSON field - simpler than tag joins!
    const rawQuery = `
    SELECT 
      q.id as quest_id,
      q.name as quest_name,
      q.source as quest_source,
      q.created_at as quest_created_at,
      q.download_profiles as quest_download_profiles,
      CAST(json_extract(q.metadata, '$.bible.chapter') AS INTEGER) as chapter_number
    FROM quest q
    WHERE 
      REPLACE(q.project_id, '-', '') = REPLACE(?, '-', '')
      AND json_extract(q.metadata, '$.bible.book') = ?
      AND json_extract(q.metadata, '$.bible.chapter') IS NOT NULL
  `;

    const result = await system.powersync.execute(rawQuery, [
        projectId,
        bookId
    ]);

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
        // Query Supabase using JSONB operators
        const { data, error } = await system.supabaseConnector.client
            .from('quest')
            .select('id, name, created_at, download_profiles, metadata')
            .eq('project_id', projectId)
            .filter('metadata->bible->>book', 'eq', bookId)
            .not('metadata->bible->>chapter', 'is', null)
            .overrideTypes<{
                id: string;
                name: string;
                created_at: string;
                download_profiles: string[] | null;
                metadata: { bible?: { book: string; chapter: number } } | null;
            }[]>();

        if (error) {
            console.error('[fetchCloudChapters] Supabase error:', error);
            return [];
        }

        if (data.length === 0) {
            console.log('[fetchCloudChapters] No chapters found in cloud');
            return [];
        }

        // Map to QuestWithMetadata format
        const results: QuestWithMetadata[] = data
            .filter(q => q.metadata?.bible?.chapter !== undefined)
            .map(q => ({
                quest_id: q.id,
                quest_name: q.name,
                quest_source: 'cloud' as HybridDataSource,
                quest_created_at: q.created_at,
                quest_download_profiles: q.download_profiles,
                chapter_number: q.metadata!.bible!.chapter
            }));

        console.log(`[fetchCloudChapters] Found ${results.length} cloud chapters`);
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
 * HYBRID: Checks both local PowerSync AND cloud Supabase for chapters
 */
export function useBibleChapters(projectId: string, bookId: string) {
    const isOnline = useNetworkStatus();

    const {
        data: chapters = [],
        isLoading,
        error
    } = useQuery({
        queryKey: ['bible-chapters', projectId, bookId],
        queryFn: async () => {
            // Always fetch local data
            const localResults = await fetchLocalChapters(projectId, bookId);

            // Fetch cloud data if online
            let cloudResults: QuestWithMetadata[] = [];
            if (isOnline) {
                cloudResults = await fetchCloudChapters(projectId, bookId);
            }

            // Combine and deduplicate
            const allResults = [...localResults, ...cloudResults];
            return processChapterResults(allResults);
        },
        enabled: !!projectId && !!bookId
    });

    // Get just the chapter numbers that exist
    const existingChapterNumbers = chapters.map((ch) => ch.chapterNumber);

    return {
        chapters,
        existingChapterNumbers,
        isLoading,
        error
    };
}
