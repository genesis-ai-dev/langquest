import { quest, quest_tag_link, tag } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { BIBLE_TAG_KEYS, parseBibleTags } from '@/utils/bibleTagUtils';
import { normalizeUuid } from '@/utils/uuidUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import { useQuery } from '@tanstack/react-query';
import { and, eq, inArray } from 'drizzle-orm';

export interface BibleChapter {
  id: string;
  name: string;
  chapterNumber: number;
  source: HybridDataSource;
  hasLocalCopy: boolean; // NEW: Indicates if local version exists
  hasSyncedCopy: boolean; // NEW: Indicates if synced version exists
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
      // Single query to get all quests with their tags
      // This reduces round trips from 3 queries to 1
      const questResults = await system.db
        .select({
          quest_id: quest.id,
          quest_name: quest.name,
          quest_source: quest.source,
          quest_created_at: quest.created_at,
          quest_download_profiles: quest.download_profiles,
          tag_key: tag.key,
          tag_value: tag.value
        })
        .from(quest)
        .innerJoin(quest_tag_link, eq(quest.id, quest_tag_link.quest_id))
        .innerJoin(tag, eq(quest_tag_link.tag_id, tag.id))
        .where(
          and(
            eq(quest.project_id, projectId),
            // Get all tags for quests that have the book tag
            inArray(
              quest.id,
              system.db
                .select({ id: quest.id })
                .from(quest)
                .innerJoin(
                  quest_tag_link,
                  eq(quest.id, quest_tag_link.quest_id)
                )
                .innerJoin(tag, eq(quest_tag_link.tag_id, tag.id))
                .where(
                  and(
                    eq(quest.project_id, projectId),
                    eq(tag.key, BIBLE_TAG_KEYS.BOOK),
                    eq(tag.value, bookId)
                  )
                )
            )
          )
        );

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
