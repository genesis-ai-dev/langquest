import { DownloadIndicator } from '@/components/DownloadIndicator';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import type { quest_closure } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useBibleChapterCreation } from '@/hooks/useBibleChapterCreation';
import { useBibleChapters } from '@/hooks/useBibleChapters';
import { BOOK_GRAPHICS } from '@/utils/BOOK_GRAPHICS';
import { useThemeColor } from '@/utils/styleUtils';
import { HardDriveIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import {
  useHybridData,
  useItemDownload,
  useItemDownloadStatus
} from './useHybridData';

interface BibleChapterListProps {
  projectId: string;
  bookId: string;
}

type QuestClosure = typeof quest_closure.$inferSelect;

// Helper component to handle individual chapter download state
function ChapterButton({
  chapterNum,
  verseCount,
  existingChapter,
  isCreatingThis,
  onPress,
  disabled
}: {
  chapterNum: number;
  verseCount: number;
  existingChapter?: {
    id: string;
    name: string;
    source: string;
    hasLocalCopy: boolean;
    hasSyncedCopy: boolean;
    download_profiles?: string[] | null;
  };
  isCreatingThis: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  const { currentUser } = useAuth();
  const exists = !!existingChapter;
  const hasLocalCopy = existingChapter?.hasLocalCopy ?? false;
  const hasSyncedCopy = existingChapter?.hasSyncedCopy ?? false;
  const isCloudQuest = existingChapter?.source === 'cloud';

  // Download status and handler
  const isDownloaded = useItemDownloadStatus(existingChapter, currentUser?.id);
  const needsDownload = isCloudQuest && !isDownloaded;

  // console.log for debugging
  // console.log(
  //   `Chapter ${chapterNum}: hasLocal=${hasLocalCopy}, hasSynced=${hasSyncedCopy}, source=${existingChapter?.source}`
  // );

  // Quest closure data for download stats
  const { data: questClosureData } = useHybridData<QuestClosure>({
    dataType: 'quest_closure',
    queryKeyParams: [existingChapter?.id || ''],
    offlineQuery: `SELECT * FROM quest_closure WHERE quest_id = '${existingChapter?.id || ''}' LIMIT 1`,
    cloudQueryFn: async () => {
      if (!existingChapter?.id) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('quest_closure')
        .select('*')
        .eq('quest_id', existingChapter.id)
        .limit(1)
        .overrideTypes<QuestClosure[]>();
      if (error) {
        console.warn('Error fetching quest closure from cloud:', error);
        return [];
      }
      return data;
    },
    enableOfflineQuery: !!existingChapter?.id,
    getItemId: (item: QuestClosure) => item.quest_id
  });

  const { mutate: downloadQuest, isPending: isDownloading } = useItemDownload(
    'quest',
    existingChapter?.id || ''
  );

  const handleDownloadToggle = () => {
    if (!currentUser?.id || !existingChapter?.id) return;
    if (!isDownloaded) {
      downloadQuest({ userId: currentUser.id, download: true });
    }
  };

  const questClosure = questClosureData[0] as QuestClosure | undefined;
  const downloadStats = {
    totalAssets: questClosure?.total_assets ?? 0,
    totalTranslations: questClosure?.total_translations ?? 0
  };

  return (
    <View className="relative w-[90px] flex-col gap-1">
      <Button
        variant={exists ? 'default' : 'outline'}
        className={`w-full flex-col gap-1 py-3 ${!exists ? 'border-dashed' : ''} ${
          needsDownload ? 'opacity-50' : ''
        } ${hasSyncedCopy ? 'bg-chart-5' : ''} ${hasLocalCopy ? 'bg-chart-2' : ''}`}
        onPress={onPress}
        disabled={disabled || needsDownload}
      >
        {isCreatingThis ? (
          <ActivityIndicator size="small" />
        ) : (
          <View className="flex-col items-center gap-1">
            <View className="flex-row items-center gap-1">
              {hasLocalCopy && (
                <Icon
                  as={HardDriveIcon}
                  size={14}
                  className="text-primary-foreground"
                />
              )}
              <Text className="text-lg font-bold">{chapterNum}</Text>
            </View>
            <Text
              className={`text-xs ${
                exists ? 'text-primary-foreground/70' : 'text-muted-foreground'
              }`}
            >
              {verseCount}
            </Text>
          </View>
        )}
      </Button>
      {/* Show download indicator if synced OR cloud */}
      {exists && (hasSyncedCopy || isCloudQuest) && (
        <View className="absolute right-1 top-1">
          <DownloadIndicator
            isFlaggedForDownload={isDownloaded}
            isLoading={isDownloading}
            onPress={handleDownloadToggle}
            downloadType="quest"
            stats={downloadStats}
            size={16}
          />
        </View>
      )}
    </View>
  );
}

export function BibleChapterList({ projectId, bookId }: BibleChapterListProps) {
  const { goToQuest } = useAppNavigation();
  const { project } = useProjectById(projectId);
  const { createChapter, isCreating } = useBibleChapterCreation();
  const book = getBibleBook(bookId);
  const IconComponent = BOOK_GRAPHICS[bookId];
  const primaryColor = useThemeColor('primary');

  // Query existing chapters using bookId (tag-based identification)
  const {
    existingChapterNumbers: _existingChapterNumbers,
    chapters: existingChapters,
    isLoading: isLoadingChapters
  } = useBibleChapters(projectId, bookId);

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
      // TODO: Show error toast or something to user
    } finally {
      setCreatingChapter(null);
    }
  };

  // Generate array of chapter numbers
  const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1);

  return (
    <View className="flex-1">
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
                const isCreatingThis = creatingChapter === chapterNum;

                return (
                  <ChapterButton
                    key={chapterNum}
                    chapterNum={chapterNum}
                    verseCount={verseCount}
                    existingChapter={existingChapter}
                    isCreatingThis={isCreatingThis}
                    onPress={() => handleChapterPress(chapterNum)}
                    disabled={Boolean(isCreating || isLoadingChapters)}
                  />
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
