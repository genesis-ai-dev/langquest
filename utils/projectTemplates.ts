import { BIBLE_BOOKS } from '@/constants/bibleStructure';
import type { AssetTemplate } from '@/database_services/assetService';

export interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    questCount: number;
    assetCount: number;
    createQuests: (sourceLanguageId: string) => QuestTemplate[];
    createAssets: (sourceLanguageId: string, questId: string, questName: string) => AssetTemplate[];
}

export interface QuestTemplate {
    name: string;
    description?: string;
    visible: boolean;
}

// Convert BibleBook format to the format expected by the template
const TEMPLATE_BIBLE_BOOKS = BIBLE_BOOKS.map(book => ({
    name: book.name,
    chapters: book.verses // verses per chapter array
}));

export const BIBLE_TEMPLATE: ProjectTemplate = {
    id: 'bible-translation',
    name: 'Bible Translation',
    description: 'Complete Bible translation project with all 66 books, chapters, and verses',
    questCount: TEMPLATE_BIBLE_BOOKS.reduce((total, book) => total + book.chapters.length, 0), // ~1189 chapters
    assetCount: TEMPLATE_BIBLE_BOOKS.reduce((total, book) =>
        total + book.chapters.reduce((chapterTotal, verseCount) => chapterTotal + verseCount, 0), 0
    ), // ~31,102 verses

    createQuests: (_sourceLanguageId: string): QuestTemplate[] => {
        const quests: QuestTemplate[] = [];

        TEMPLATE_BIBLE_BOOKS.forEach((book) => {
            book.chapters.forEach((verseCount, chapterIndex) => {
                const chapterNumber = chapterIndex + 1;
                quests.push({
                    name: `${book.name} ${chapterNumber}`,
                    description: `Chapter ${chapterNumber} of ${book.name} (${verseCount} verses)`,
                    visible: true
                });
            });
        });

        return quests;
    },

    createAssets: (sourceLanguageId: string, _questId: string, questName: string): AssetTemplate[] => {
        // Parse the quest name to get book and chapter info
        // Quest names are in format: "BookName ChapterNumber" (e.g., "1 Samuel 3", "Song of Solomon 2")
        const parts = questName.split(' ');
        if (parts.length < 2) return [];

        // The last part should be the chapter number
        const chapterStr = parts[parts.length - 1]!;
        const chapterNumber = parseInt(chapterStr, 10);

        if (!chapterStr || isNaN(chapterNumber)) return [];

        // Everything except the last part is the book name
        const bookName = parts.slice(0, -1).join(' ');

        if (!bookName) return [];

        // Find the book and get verse count
        const book = TEMPLATE_BIBLE_BOOKS.find(b => b.name === bookName);
        if (!book) return [];

        const verseCount = book.chapters[chapterNumber - 1];
        if (!verseCount) return [];

        // Create asset templates for each verse
        const assets: AssetTemplate[] = [];
        for (let verse = 1; verse <= verseCount; verse++) {
            assets.push({
                name: `${bookName} ${chapterNumber}:${verse}`,
                source_language_id: sourceLanguageId,
                text_content: `[${bookName} ${chapterNumber}:${verse} - Add source text here]`,
                visible: true
            });
        }

        return assets;
    }
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
    BIBLE_TEMPLATE
];

export function getTemplateById(id: string): ProjectTemplate | undefined {
    return PROJECT_TEMPLATES.find(template => template.id === id);
} 