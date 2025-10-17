import { DownloadIndicator } from '@/components/DownloadIndicator';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { getBibleBook } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectById } from '@/hooks/db/useProjects';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useBibleChapterCreation } from '@/hooks/useBibleChapterCreation';
import { useBibleChapters } from '@/hooks/useBibleChapters';
import { BOOK_ICON_MAP } from '@/utils/BOOK_GRAPHICS';
import { cn, useThemeColor } from '@/utils/styleUtils';
import { LegendList } from '@legendapp/list';
import { Image } from 'expo-image';
import { HardDriveIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useItemDownload, useItemDownloadStatus } from './useHybridData';

interface BibleChapterListProps {
  projectId: string;
  bookId: string;
}

// type QuestClosure = typeof quest_closure.$inferSelect;

// Simple skeleton for chapter buttons during loading
const ChapterSkeleton = () => (
  <View className="w-full flex-col items-center gap-1 rounded-md border border-border bg-muted/50 py-3">
    <Skeleton style={{ width: 32, height: 24 }} />
    <Skeleton style={{ width: 24, height: 14 }} />
  </View>
);

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
  const primaryColor = useThemeColor('primary');

  // Download status and handler
  const isDownloaded = useItemDownloadStatus(existingChapter, currentUser?.id);
  const needsDownload = isCloudQuest && !isDownloaded;

  // TODO: Optimize - query all quest_closure data once at parent level instead of per-button
  // const { data: questClosureData } = useHybridData<QuestClosure>({
  //   dataType: 'quest_closure',
  //   queryKeyParams: [existingChapter?.id || ''],
  //   offlineQuery: `SELECT * FROM quest_closure WHERE quest_id = '${existingChapter?.id || ''}' LIMIT 1`,
  //   cloudQueryFn: async () => {
  //     if (!existingChapter?.id) return [];
  //     const { data, error } = await system.supabaseConnector.client
  //       .from('quest_closure')
  //       .select('*')
  //       .eq('quest_id', existingChapter.id)
  //       .limit(1)
  //       .overrideTypes<QuestClosure[]>();
  //     if (error) {
  //       console.warn('Error fetching quest closure from cloud:', error);
  //       return [];
  //     }
  //     return data;
  //   },
  //   enableOfflineQuery: !!existingChapter?.id,
  //   getItemId: (item: QuestClosure) => item.quest_id
  // });

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

  // const questClosure = questClosureData[0] as QuestClosure | undefined;
  const downloadStats = {
    totalAssets: 0, // questClosure?.total_assets ?? 0,
    totalTranslations: 0 // questClosure?.total_translations ?? 0
  };

  // Use semantic Tailwind colors for status, matching conventions:
  // - Published: success/green (chart-3)
  // - Local only: info/blue (chart-2)
  // - Not created: muted
  // - Foreground should always be readable (primary-foreground for filled, foreground for outline)
  const getBackgroundColor = () => {
    if (hasSyncedCopy) return 'bg-chart-3'; // Published (Success, Green)
    if (hasLocalCopy) return 'bg-chart-2'; // Local-only (Info, Blue)
    if (exists) return 'bg-card'; // Exists but not local or synced
    return 'bg-muted'; // Not yet created (empty slot)
  };

  const getTextColor = () => {
    if (hasSyncedCopy || hasLocalCopy) return 'text-secondary';
    if (exists) return 'text-foreground';
    return 'text-muted-foreground';
  };

  return (
    <View className="relative w-full flex-col gap-1">
      <Button
        variant={exists ? 'default' : 'outline'}
        className={cn(
          'w-full flex-col gap-1 py-3',
          !exists && 'border-dashed',
          needsDownload && 'opacity-50',
          getBackgroundColor()
        )}
        onPress={onPress}
        disabled={disabled || needsDownload}
      >
        {isCreatingThis ? (
          <ActivityIndicator size="small" color={primaryColor} />
        ) : (
          <View className="flex-col items-center gap-1">
            <View className="flex-row items-center gap-1">
              {hasLocalCopy && (
                <Icon as={HardDriveIcon} size={14} className="text-secondary" />
              )}
              {exists && (hasSyncedCopy || isCloudQuest) && (
                <DownloadIndicator
                  isFlaggedForDownload={isDownloaded}
                  isLoading={isDownloading}
                  onPress={handleDownloadToggle}
                  downloadType="quest"
                  stats={downloadStats}
                  size={16}
                  // Always use neutral/foreground for indicator to be visible
                  className={
                    hasSyncedCopy || hasLocalCopy
                      ? 'text-card-foreground'
                      : 'text-foreground'
                  }
                />
              )}
              <Text className={cn('text-lg font-bold', getTextColor())}>
                {chapterNum}
              </Text>
            </View>
            {/* <Text
              className={cn(
                "text-xs",
                exists ? "text-card-foreground/70" : "text-muted-foreground"
              )}
            >
              {verseCount} vs
            </Text> */}
          </View>
        )}
      </Button>
    </View>
  );
}

export function BibleChapterList({ projectId, bookId }: BibleChapterListProps) {
  const { goToQuest } = useAppNavigation();
  const { project } = useProjectById(projectId);
  const { createChapter, isCreating } = useBibleChapterCreation();
  const book = getBibleBook(bookId);
  const bookIconSource = BOOK_ICON_MAP[bookId];
  const primaryColor = useThemeColor('primary');

  // Query existing chapters using parent-child relationship
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
        <ActivityIndicator size="large" color={primaryColor} />
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

  // Generate array of chapter numbers with metadata
  const chapters = Array.from({ length: book.chapters }, (_, i) => {
    const chapterNum = i + 1;
    const verseCount = book.verses[chapterNum - 1] || 0;
    const existingChapter = existingChapters.find(
      (ch) => ch.chapterNumber === chapterNum
    );
    const isCreatingThis = creatingChapter === chapterNum;

    return {
      id: chapterNum,
      chapterNum,
      verseCount,
      existingChapter,
      isCreatingThis
    };
  });

  return (
    <View className="flex-1">
      <View className="flex-1 flex-col gap-6">
        {/* Header */}
        <View className="flex-row items-center gap-3">
          {bookIconSource ? (
            <Image
              source={bookIconSource}
              style={{ width: 48, height: 48, tintColor: primaryColor }}
              contentFit="contain"
            />
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
        {isLoadingChapters ? (
          <LegendList
            data={chapters.slice(0, 32)}
            keyExtractor={(item) => item.id.toString()}
            numColumns={4}
            estimatedItemSize={90}
            contentContainerStyle={{ paddingHorizontal: 8 }}
            columnWrapperStyle={{ gap: 8 }}
            renderItem={() => <ChapterSkeleton />}
          />
        ) : (
          <LegendList
            data={chapters}
            keyExtractor={(item) => item.id.toString()}
            numColumns={4}
            estimatedItemSize={90}
            contentContainerStyle={{ paddingHorizontal: 8 }}
            columnWrapperStyle={{ gap: 8 }}
            recycleItems
            renderItem={({ item }) => (
              <ChapterButton
                chapterNum={item.chapterNum}
                verseCount={item.verseCount}
                existingChapter={item.existingChapter}
                isCreatingThis={item.isCreatingThis}
                onPress={() => handleChapterPress(item.chapterNum)}
                disabled={Boolean(isCreating || isLoadingChapters)}
              />
            )}
          />
        )}
      </View>
    </View>
  );
}
