import { quest, quest_tag_link, tag } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { BIBLE_TAG_KEYS, parseBibleTags } from '@/utils/bibleTagUtils';
import { mergeQuery } from '@/utils/dbUtils';
import { normalizeUuid } from '@/utils/uuidUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useQuery } from '@tanstack/react-query';
import { and, eq } from 'drizzle-orm';

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
 * Uses Bible tags (bible:book, bible:chapter) for localization-proof identification
 * Returns chapters with source tracking for both local and synced versions
 * CRITICAL: Properly deduplicates by chapter number to prevent multiple IDs with same name
 */
export function useBibleChapters(projectId: string, bookId: string) {
    const { data: chapters = [], isLoading } = useQuery({
        queryKey: ['bible-chapters', projectId, bookId],
        queryFn: async (): Promise<BibleChapter[]> => {
            // Query for quests tagged with bible:book matching bookId
            // Uses tag-based identification instead of name pattern matching
            // This is localization-proof: works regardless of quest name language

            // First, get all quests with Bible book tags (with source field from mergeQuery)
            const questQuery = system.db
                .select()
                .from(quest)
                .innerJoin(quest_tag_link, eq(quest.id, quest_tag_link.quest_id))
                .innerJoin(tag, eq(quest_tag_link.tag_id, tag.id))
                .where(
                    and(
                        eq(quest.project_id, projectId),
                        eq(tag.key, BIBLE_TAG_KEYS.BOOK),
                        eq(tag.value, bookId)
                    )
                );

            const questResults = await mergeQuery(questQuery);

            // Get all tags for these quests to parse chapter numbers
            const questIds = Array.from(new Set(questResults.map(r => r.quest.id)));

            if (questIds.length === 0) {
                return [];
            }

            // Fetch all tags for these quests using query builder
            const tagResults = await system.db.query.quest_tag_link.findMany({
                where: (qtl, { inArray }) => inArray(qtl.quest_id, questIds),
                with: {
                    tag: true
                }
            });

            // Group tags by quest ID
            const tagsByQuest = new Map<string, { key: string; value: string }[]>();
            for (const { quest_id, tag: tagData } of tagResults) {
                const normalizedId = normalizeUuid(quest_id);
                if (!tagsByQuest.has(normalizedId)) {
                    tagsByQuest.set(normalizedId, []);
                }
                tagsByQuest.get(normalizedId)!.push({
                    key: tagData.key,
                    value: tagData.value
                });
            }

            // Group quest records by normalized ID
            type QuestWithSource = typeof questResults[0]['quest'] & { source: HybridDataSource };
            const questMap = new Map<string, {
                quest: QuestWithSource;
                tags: { key: string; value: string }[];
            }>();

            for (const row of questResults) {
                const questId = normalizeUuid(row.quest.id);
                if (!questMap.has(questId)) {
                    questMap.set(questId, {
                        quest: row.quest as QuestWithSource,
                        tags: tagsByQuest.get(questId) || []
                    });
                }
            }

            // CRITICAL: Group by CHAPTER NUMBER, not by ID
            // This handles the case where multiple quest IDs exist for same chapter
            // IMPORTANT: Normalize IDs when comparing (local has no dashes, synced has dashes)
            const chapterMap = new Map<number, {
                id: string;
                name: string;
                chapterNumber: number;
                sources: Set<HybridDataSource>;
                download_profiles?: string[] | null;
                created_at: string;
            }>();

            for (const { quest: q, tags: questTags } of questMap.values()) {
                // Parse Bible tags to get chapter number
                const bibleRef = parseBibleTags(questTags);
                if (!bibleRef.chapter) continue;

                const chapterNumber = bibleRef.chapter;
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
            }

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

