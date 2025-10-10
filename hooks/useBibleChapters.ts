import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { mergeQuery } from '@/utils/dbUtils';
import { normalizeUuid } from '@/utils/uuidUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useQuery } from '@tanstack/react-query';
import { and, eq, like } from 'drizzle-orm';

export interface BibleChapter {
    id: string;
    name: string;
    chapterNumber: number;
    source: HybridDataSource;
    hasLocalCopy: boolean;    // NEW: Indicates if local version exists
    hasSyncedCopy: boolean;   // NEW: Indicates if synced version exists
    download_profiles?: string[] | null;
}

/**
 * Hook to query existing chapter quests for a Bible book
 * Uses quest name pattern matching: "BookName ChapterNumber"
 * Returns chapters with source tracking for both local and synced versions
 * CRITICAL: Properly deduplicates by chapter number to prevent multiple IDs with same name
 */
export function useBibleChapters(projectId: string, bookName: string) {
    const { data: chapters = [], isLoading } = useQuery({
        queryKey: ['bible-chapters', projectId, bookName],
        queryFn: async (): Promise<BibleChapter[]> => {
            // Query for quests that match the pattern "BookName ChapterNumber"
            // e.g., "Genesis 1", "Genesis 2", etc.
            // Use mergeQuery to get source field (local vs synced)
            const mergeableQuery = system.db
                .select()
                .from(quest)
                .where(
                    and(
                        eq(quest.project_id, projectId),
                        like(quest.name, `${bookName} %`)
                    )
                );

            const results = await mergeQuery(mergeableQuery);


            // CRITICAL: Group by CHAPTER NUMBER, not by ID
            // This handles the case where multiple quest IDs exist for same chapter
            // (e.g., "Ruth 1" created multiple times with different IDs)
            // IMPORTANT: Normalize IDs when comparing (local has no dashes, synced has dashes)
            const chapterMap = new Map<number, {
                id: string;
                name: string;
                chapterNumber: number;
                sources: Set<HybridDataSource>;
                download_profiles?: string[] | null;
                created_at: string;
            }>();

            results.forEach((q) => {
                // Extract number from name like "Genesis 1" -> 1
                const match = /\s+(\d+)$/.exec(q.name);
                if (!match?.[1]) return;

                const chapterNumber = parseInt(match[1], 10);
                if (chapterNumber === 0 || isNaN(chapterNumber)) return;

                const existing = chapterMap.get(chapterNumber);

                // Priority logic for handling duplicates:
                // 1. Prefer synced over local
                // 2. If same source, prefer newer created_at
                // 3. This ensures we show the "canonical" version
                const shouldReplace = !existing ||
                    (q.source === 'synced' && existing.sources.has('local') && !existing.sources.has('synced')) ||
                    (q.source === existing.sources.values().next().value && q.created_at > existing.created_at);

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
            });

            const chapters = Array.from(chapterMap.values())
                .map((ch): BibleChapter => ({
                    id: ch.id,
                    name: ch.name,
                    chapterNumber: ch.chapterNumber,
                    // Primary source: synced > local > cloud
                    source: ch.sources.has('synced') ? 'synced' :
                        ch.sources.has('local') ? 'local' : 'cloud',
                    hasLocalCopy: ch.sources.has('local'),
                    hasSyncedCopy: ch.sources.has('synced'),
                    download_profiles: ch.download_profiles
                }))
                .sort((a, b) => a.chapterNumber - b.chapterNumber);

            return chapters;
        },
        enabled: !!projectId && !!bookName
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

