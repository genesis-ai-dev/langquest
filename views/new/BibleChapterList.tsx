import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getBibleBook } from '@/constants/bibleStructure';
import { useProjectById } from '@/hooks/db/useProjects';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useBibleChapterCreation } from '@/hooks/useBibleChapterCreation';
import { useBibleChapters } from '@/hooks/useBibleChapters';
import { BOOK_GRAPHICS } from '@/utils/BOOK_GRAPHICS';
import { useThemeColor } from '@/utils/styleUtils';
import { Share2 } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
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
  const IconComponent = BOOK_GRAPHICS[bookId];
  const primaryColor = useThemeColor('primary');

  // Query existing chapters
  const {
    existingChapterNumbers,
    chapters: existingChapters,
    isLoading: isLoadingChapters
  } = useBibleChapters(projectId, book?.name || '');

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
    // Prevent any action while loading or creating
    if (isLoadingChapters || isCreating || creatingChapter === chapterNum) {
      return;
    }

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

  const handleSharePress = (chapterNum: number, chapterName: string) => {
    Alert.alert(
      'Publish Chapter',
      `Mock publish functionality for ${chapterName}.\n\nThis would publish the chapter and all its recordings to make them available to other users.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Publish',
          onPress: () => {
            console.log(`📤 Publishing ${chapterName}...`);
            // TODO: Implement actual publish functionality
          }
        }
      ]
    );
  };

  // Generate array of chapter numbers
  const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1);

  return (
    <ScrollView className="flex-1">
      <View className="flex-col gap-4 p-4">
        {/* Header */}
        <View className="flex-row items-center gap-3">
          {IconComponent ? (
            <IconComponent width={48} height={48} color={primaryColor} />
          ) : (
            <Text className="text-4xl">📖</Text>
          )}
          <View className="flex-col">
            <Text variant="h3">{book.name}</Text>
            <Text className="text-sm text-muted-foreground">
              {book.chapters} chapters
            </Text>
          </View>
        </View>

        {/* Chapter Grid */}
        <View className="flex-row flex-wrap gap-2">
          {isLoadingChapters ? (
            // Show loading skeleton
            <View className="flex-row flex-wrap gap-2">
              {chapters.slice(0, 6).map((chapterNum) => (
                <View
                  key={chapterNum}
                  className="w-[90px] flex-col gap-1 rounded-md border border-border bg-muted/50 py-3"
                >
                  <ActivityIndicator size="small" />
                </View>
              ))}
            </View>
          ) : (
            chapters.map((chapterNum) => {
              const verseCount = book.verses[chapterNum - 1] || 0;
              const existingChapter = existingChapters.find(
                (ch) => ch.chapterNumber === chapterNum
              );
              const exists = !!existingChapter;
              const isLocal = existingChapter?.source === 'local';
              const isCreatingThis = creatingChapter === chapterNum;

              return (
                <View
                  key={chapterNum}
                  className="relative w-[90px] flex-col gap-1"
                >
                  <Button
                    variant={exists ? 'default' : 'outline'}
                    className={`w-full flex-col gap-1 py-3 ${
                      !exists ? 'border-dashed' : ''
                    }`}
                    onPress={() => handleChapterPress(chapterNum)}
                    disabled={isCreating || isLoadingChapters}
                  >
                    {isCreatingThis ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <>
                        <Text className="text-lg font-bold">{chapterNum}</Text>
                        <Text
                          className={`text-xs ${
                            exists
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {verseCount} verses
                        </Text>
                      </>
                    )}
                  </Button>
                  {exists && isLocal && (
                    <Pressable
                      onPress={() =>
                        handleSharePress(chapterNum, existingChapter.name)
                      }
                      className="absolute right-1 top-1 rounded-full bg-primary/10 p-1"
                    >
                      <Icon
                        as={Share2}
                        size={12}
                        className="text-primary-foreground"
                      />
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}
