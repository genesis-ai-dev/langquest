import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getBibleBook } from '@/constants/bibleStructure';
import { useProjectById } from '@/hooks/db/useProjects';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useBibleChapterCreation } from '@/hooks/useBibleChapterCreation';
import { useBibleChapters } from '@/hooks/useBibleChapters';
import { BOOK_EMOJIS } from '@/utils/BOOK_EMOJIS';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

interface BibleChapterListProps {
  projectId: string;
  bookId: string;
}

export function BibleChapterList({ projectId, bookId }: BibleChapterListProps) {
  const { goToQuest } = useAppNavigation();
  const { project } = useProjectById(projectId);
  const { createChapter, isCreating } = useBibleChapterCreation();
  const book = getBibleBook(bookId);
  const emoji = BOOK_EMOJIS[bookId] || '📖';

  // Query existing chapters
  const { existingChapterNumbers, chapters: existingChapters } =
    useBibleChapters(projectId, book?.name || '');

  const [creatingChapter, setCreatingChapter] = React.useState<number | null>(
    null
  );

  if (!book) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text>Book not found: {bookId}</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <ActivityIndicator size="large" />
        <Text className="mt-4">Loading project...</Text>
      </View>
    );
  }

  const handleChapterPress = async (chapterNum: number) => {
    if (isCreating) return; // Prevent double-clicks

    // Check if chapter already exists
    const existingChapter = existingChapters.find(
      (ch) => ch.chapterNumber === chapterNum
    );

    if (existingChapter) {
      // Chapter exists, just navigate to it
      console.log(`📖 Opening existing chapter: ${existingChapter.id}`);
      goToQuest({
        id: existingChapter.id,
        project_id: projectId,
        name: existingChapter.name
      });
      return;
    }

    // Chapter doesn't exist, create it
    setCreatingChapter(chapterNum);

    try {
      console.log(`📖 Creating new chapter: ${book.name} ${chapterNum}`);

      const result = await createChapter({
        projectId,
        bookId,
        chapter: chapterNum,
        targetLanguageId: project.target_language_id
      });

      console.log(
        `✅ Chapter created! Quest ID: ${result.questId}, ${result.assetCount} assets`
      );

      // Navigate to assets view
      goToQuest({
        id: result.questId,
        project_id: projectId,
        name: result.questName
      });
    } catch (error) {
      console.error('Failed to create chapter:', error);
      // TODO: Show error toast to user
    } finally {
      setCreatingChapter(null);
    }
  };

  // Generate array of chapter numbers
  const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1);

  return (
    <ScrollView className="flex-1">
      <View className="flex-col gap-4 p-4">
        {/* Header */}
        <View className="flex-row items-center gap-3">
          <Text className="text-4xl">{emoji}</Text>
          <View className="flex-col">
            <Text variant="h3">{book.name}</Text>
            <Text className="text-sm text-muted-foreground">
              {book.chapters} chapters
            </Text>
          </View>
        </View>

        {/* Chapter Grid */}
        <View className="flex-row flex-wrap gap-2">
          {chapters.map((chapterNum) => {
            const verseCount = book.verses[chapterNum - 1] || 0;
            const exists = existingChapterNumbers.has(chapterNum);
            const isCreatingThis = creatingChapter === chapterNum;

            return (
              <Button
                key={chapterNum}
                variant="outline"
                className={`w-[90px] flex-col gap-1 py-3 ${
                  exists ? 'border-solid' : 'border-dashed'
                }`}
                onPress={() => handleChapterPress(chapterNum)}
                disabled={isCreating}
              >
                {isCreatingThis ? (
                  <>
                    <ActivityIndicator size="small" />
                    <Text className="text-xs text-muted-foreground">
                      Creating...
                    </Text>
                  </>
                ) : (
                  <>
                    <Text className="text-lg font-bold">{chapterNum}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {verseCount} verses
                    </Text>
                  </>
                )}
              </Button>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
