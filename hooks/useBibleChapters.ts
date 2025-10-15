import { system } from '@/db/powersync/system';
import { BIBLE_TAG_KEYS, parseBibleTags } from '@/utils/bibleTagUtils';
import { normalizeUuid } from '@/utils/uuidUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useQuery } from '@tanstack/react-query';
import { useNetworkStatus } from './useNetworkStatus';

export interface BibleChapter {
    id: string;
    name: string;
    chapterNumber: number;
    source: HybridDataSource;
    hasLocalCopy: boolean; // NEW: Indicates if local version exists
    hasSyncedCopy: boolean; // NEW: Indicates if synced version exists
    download_profiles?: string[] | null;
}

interface QuestWithTags {
    quest_id: string;
    quest_name: string;
    quest_source: HybridDataSource;
    quest_created_at: string;
    quest_download_profiles: string[] | null;
    tag_key: string;
    tag_value: string;
}

/**
 * Fetches quests with their tags for a given project and book from local database
 * NOTE: Uses union views (quest, quest_tag_link, tag) that combine local + synced tables
 * CRITICAL: Uses raw SQL to normalize UUIDs during JOIN (remove dashes for comparison)
 */
async function fetchLocalChapters(
    projectId: string,
    bookId: string
): Promise<QuestWithTags[]> {
    console.log(
        `[fetchLocalChapters] Querying union views for projectId: ${projectId}, bookId: ${bookId}`
    );

    // CRITICAL: We need to normalize UUIDs in the JOIN conditions because:
    // - Synced records have UUIDs WITH dashes: "b6f71550-030a-5ab0-7792-cc9319839309"
    // - Local records have UUIDs WITHOUT dashes: "b6f71550030a5ab07792cc9319839309"
    // Using Drizzle's eq() does string comparison which fails across sources
    // Solution: Use raw SQL with REPLACE to normalize during JOIN
    // NOTE: Pass projectId/bookId directly - REPLACE handles normalization in SQL

    const rawQuery = `
    SELECT 
      q.id as quest_id,
      q.name as quest_name,
      q.source as quest_source,
      q.created_at as quest_created_at,
      q.download_profiles as quest_download_profiles,
      t.key as tag_key,
      t.value as tag_value
    FROM quest q
    INNER JOIN quest_tag_link qtl 
      ON REPLACE(q.id, '-', '') = REPLACE(qtl.quest_id, '-', '')
    INNER JOIN tag t 
      ON REPLACE(qtl.tag_id, '-', '') = REPLACE(t.id, '-', '')
    WHERE 
      REPLACE(q.project_id, '-', '') = REPLACE(?, '-', '')
      AND REPLACE(q.id, '-', '') IN (
        SELECT REPLACE(q2.id, '-', '')
        FROM quest q2
        INNER JOIN quest_tag_link qtl2 
          ON REPLACE(q2.id, '-', '') = REPLACE(qtl2.quest_id, '-', '')
        INNER JOIN tag t2 
          ON REPLACE(qtl2.tag_id, '-', '') = REPLACE(t2.id, '-', '')
        WHERE 
          REPLACE(q2.project_id, '-', '') = REPLACE(?, '-', '')
          AND t2.key = ?
          AND t2.value = ?
      )
  `;

    const result = await system.powersync.execute(rawQuery, [
        projectId,
        projectId,
        BIBLE_TAG_KEYS.BOOK,
        bookId
    ]);

    // Convert SQLite result to array of objects
    const questResults: QuestWithTags[] = [];
    if (result.rows) {
        for (let i = 0; i < result.rows.length; i++) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const row = result.rows.item(i);
            if (row) {
                // SQLite stores JSON arrays as strings, need to parse
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
                    tag_key: row.tag_key as string,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    tag_value: row.tag_value as string
                });
            }
        }
    }

    console.log(
        `[fetchLocalChapters] Found ${questResults.length} quest-tag results from union views`
    );

    // Log unique quest IDs and their sources
    const uniqueQuests = new Map<string, HybridDataSource>();
    for (const row of questResults) {
        if (!uniqueQuests.has(row.quest_id)) {
            uniqueQuests.set(row.quest_id, row.quest_source);
        }
    }
    console.log(
        `[fetchLocalChapters] Unique quests: ${Array.from(uniqueQuests.entries()).map(([id, source]) => `${id.slice(0, 8)}... (${source})`).join(', ')}`
    );

    return questResults;
}

/**
 * Fetches quests with their tags for a given project and book from cloud database
 * NOTE: Cloud data is always 'synced' - there's no 'source' column in Postgres
 */
async function fetchCloudChapters(
    projectId: string,
    bookId: string
): Promise<QuestWithTags[]> {
    interface CloudQuestResult {
        id: string;
        name: string;
        created_at: string;
        download_profiles: string[] | null;
        quest_tag_link: {
            tag: {
                key: string;
                value: string;
            };
        }[];
    }

    const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select(
            `
      id,
      name,
      created_at,
      download_profiles,
      quest_tag_link!inner (
        tag!inner (
          key,
          value
        )
      )
    `
        )
        .eq('project_id', projectId);

    if (error) {
        console.error('Error fetching cloud chapters:', error);
        return [];
    }

    if (data.length === 0) return [];

    // Flatten the response to match local format
    // All cloud data has source='synced' since it comes from Postgres
    const flattened: QuestWithTags[] = [];
    for (const quest of data as unknown as CloudQuestResult[]) {
        // Check if this quest has the book tag we're looking for
        const hasBookTag = quest.quest_tag_link.some(
            (link) => link.tag.key === BIBLE_TAG_KEYS.BOOK && link.tag.value === bookId
        );

        if (!hasBookTag) continue;

        // Add all tags for this quest
        for (const link of quest.quest_tag_link) {
            flattened.push({
                quest_id: quest.id,
                quest_name: quest.name,
                quest_source: 'synced', // All cloud data is synced
                quest_created_at: quest.created_at,
                quest_download_profiles: quest.download_profiles,
                tag_key: link.tag.key,
                tag_value: link.tag.value
            });
        }
    }

    return flattened;
}

/**
 * Processes quest results with tags into deduplicated chapter list
 */
function processChapterResults(
    questResults: QuestWithTags[]
): BibleChapter[] {
    if (questResults.length === 0) {
        return [];
    }

    // Group tags by quest ID in a single pass
    const questData = new Map<
        string,
        {
            id: string;
            name: string;
            source: HybridDataSource;
            created_at: string;
            download_profiles?: string[] | null;
            tags: { key: string; value: string }[];
        }
    >();

    for (const row of questResults) {
        const normalizedId = normalizeUuid(row.quest_id);
        if (!questData.has(normalizedId)) {
            questData.set(normalizedId, {
                id: row.quest_id,
                name: row.quest_name,
                source: row.quest_source,
                created_at: row.quest_created_at,
                download_profiles: row.quest_download_profiles,
                tags: []
            });
        }
        questData.get(normalizedId)!.tags.push({
            key: row.tag_key,
            value: row.tag_value
        });
    }

    // CRITICAL: Group by CHAPTER NUMBER, not by ID
    // This handles the case where multiple quest IDs exist for same chapter
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

    for (const q of questData.values()) {
        // Parse Bible tags to get chapter number
        const bibleRef = parseBibleTags(q.tags);
        if (!bibleRef.chapter) continue;

        const chapterNumber = bibleRef.chapter;
        const existing = chapterMap.get(chapterNumber);

        // Priority logic for handling duplicates:
        // 1. Prefer synced over local
        // 2. If same source, prefer newer created_at
        // 3. This ensures we show the "canonical" version
        const shouldReplace =
            !existing ||
            (q.source === 'synced' &&
                existing.sources.has('local') &&
                !existing.sources.has('synced')) ||
            (q.source === existing.sources.values().next().value &&
                q.created_at > existing.created_at);

        if (shouldReplace) {
            // Replace with this record (better priority)
            chapterMap.set(chapterNumber, {
                id: q.id,
                name: q.name,
                chapterNumber,
                sources: new Set([q.source]),
                download_profiles: q.download_profiles,
                created_at: q.created_at
            });
        } else if (normalizeUuid(q.id) === normalizeUuid(existing.id)) {
            // Same ID in different source (with/without dashes), add source to set
            existing.sources.add(q.source);
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
 * Uses Bible tags (bible:book, bible:chapter) for localization-proof identification
 * Returns chapters with source tracking for both local and synced versions
 * CRITICAL: Properly deduplicates by chapter number to prevent multiple IDs with same name
 * NOW HYBRID: Checks both local PowerSync AND cloud Supabase for chapters
 */
export function useBibleChapters(projectId: string, bookId: string) {
    const isOnline = useNetworkStatus();

    const { data: chapters = [], isLoading } = useQuery({
        queryKey: ['bible-chapters', projectId, bookId],
        queryFn: async (): Promise<BibleChapter[]> => {
            console.log(
                `[useBibleChapters] Starting hybrid query for projectId: ${projectId}, bookId: ${bookId}, isOnline: ${isOnline}`
            );

            // Fetch from both local and cloud in parallel
            const [localResults, cloudResults] = await Promise.allSettled([
                fetchLocalChapters(projectId, bookId),
                isOnline ? fetchCloudChapters(projectId, bookId) : Promise.resolve([])
            ]);

            // Extract successful results
            const localData =
                localResults.status === 'fulfilled' ? localResults.value : [];
            const cloudData =
                cloudResults.status === 'fulfilled' ? cloudResults.value : [];

            console.log(
                `[useBibleChapters] Results - Local: ${localData.length} records, Cloud: ${cloudData.length} records`
            );

            // Log any errors
            if (localResults.status === 'rejected') {
                console.error('Error fetching local chapters:', localResults.reason);
            }
            if (cloudResults.status === 'rejected') {
                console.error('Error fetching cloud chapters:', cloudResults.reason);
            }

            // Combine and process results
            const combinedResults = [...localData, ...cloudData];
            console.log(
                `[useBibleChapters] Combined ${combinedResults.length} total records before processing`
            );

            const processed = processChapterResults(combinedResults);
            console.log(
                `[useBibleChapters] Processed into ${processed.length} chapters:`,
                processed.map((ch) => `${ch.name} (${ch.source})`)
            );

            return processed;
        },
        enabled: !!projectId && !!bookId
    });

    // Create a Set of chapter numbers that exist
    const existingChapterNumbers = new Set(
        chapters.map((ch) => ch.chapterNumber)
    );

    return {
        chapters,
        existingChapterNumbers,
        isLoading
    };
}
