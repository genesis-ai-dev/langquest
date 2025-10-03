import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useQuery } from '@tanstack/react-query';
import { and, eq, like } from 'drizzle-orm';

interface BibleChapter {
    id: string;
    name: string;
    chapterNumber: number;
}

/**
 * Hook to query existing chapter quests for a Bible book
 * Uses quest name pattern matching: "BookName ChapterNumber"
 */
export function useBibleChapters(projectId: string, bookName: string) {
    const { data: chapters = [], isLoading } = useQuery({
        queryKey: ['bible-chapters', projectId, bookName],
        queryFn: async (): Promise<BibleChapter[]> => {
            // Query for quests that match the pattern "BookName ChapterNumber"
            // e.g., "Genesis 1", "Genesis 2", etc.
            const results = await system.db
                .select()
                .from(quest)
                .where(
                    and(
                        eq(quest.project_id, projectId),
                        like(quest.name, `${bookName} %`)
                    )
                );

            // Extract chapter numbers from names
            return results
                .map((q) => {
                    // Extract number from name like "Genesis 1" -> 1
                    const match = q.name.match(/\s+(\d+)$/);
                    const chapterNumber = match ? parseInt(match[1], 10) : 0;

                    return {
                        id: q.id,
                        name: q.name,
                        chapterNumber
                    };
                })
                .filter((ch) => ch.chapterNumber > 0)
                .sort((a, b) => a.chapterNumber - b.chapterNumber);
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

