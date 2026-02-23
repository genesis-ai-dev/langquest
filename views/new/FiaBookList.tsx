/**
 * Displays FIA books for a project's source language.
 * Uses the same Bible book icons and layout as BibleBookList.
 */

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { BIBLE_BOOKS } from '@/constants/bibleStructure';
import type { FiaBook } from '@/hooks/useFiaBooks';
import { useLocalization } from '@/hooks/useLocalization';
import { BOOK_ICON_MAP } from '@/utils/BOOK_GRAPHICS';
import { cn, useThemeColor } from '@/utils/styleUtils';
import { LegendList } from '@legendapp/list';
import { BookOpenIcon, PlusCircleIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Dimensions, Image, View } from 'react-native';

interface FiaBookListProps {
  books: FiaBook[];
  isLoading: boolean;
  error: Error | null;
  existingBookIds: Set<string>;
  canCreateNew: boolean;
  onBookSelect: (bookId: string) => void;
  onRefresh?: () => void;
}

/**
 * FIA book IDs that differ from our Bible BOOK_ICON_MAP keys.
 * Most FIA IDs match directly (e.g., mat, luk, jhn, act, rom, etc.)
 */
const FIA_TO_BIBLE_BOOK_ID: Record<string, string> = {
  mrk: 'mar', // FIA: mrk → Bible: mar (Mark)
  php: 'phi', // FIA: php → Bible: phi (Philippians)
  jol: 'joe', // FIA: jol → Bible: joe (Joel)
  nam: 'nah' // FIA: nam → Bible: nah (Nahum)
};

function getBibleBookId(fiaBookId: string): string {
  return FIA_TO_BIBLE_BOOK_ID[fiaBookId] ?? fiaBookId;
}

function getFiaBookIcon(fiaBookId: string) {
  const bibleId = getBibleBookId(fiaBookId);
  return BOOK_ICON_MAP[bibleId] ?? null;
}

/**
 * Build a sort-order map from BIBLE_BOOKS: { gen: 0, exo: 1, ... }
 */
const BIBLE_ORDER_MAP: Record<string, number> = Object.fromEntries(
  BIBLE_BOOKS.map((book, index) => [book.id, index])
);

/**
 * Sort FIA books into biblical order. Books not in the Bible go at the end.
 */
function sortBiblicalOrder(books: FiaBook[]): FiaBook[] {
  return [...books].sort((a, b) => {
    const orderA = BIBLE_ORDER_MAP[getBibleBookId(a.id)] ?? 999;
    const orderB = BIBLE_ORDER_MAP[getBibleBookId(b.id)] ?? 999;
    return orderA - orderB;
  });
}

export function FiaBookList({
  books,
  isLoading,
  error,
  existingBookIds,
  canCreateNew,
  onBookSelect
}: FiaBookListProps) {
  const { t } = useLocalization();
  const primaryColor = useThemeColor('primary');
  const secondaryColor = useThemeColor('chart-2');
  const screenWidth = Dimensions.get('window').width;
  const buttonWidth = 110;
  const gap = 12;
  const padding = 16;
  const availableWidth = screenWidth - padding * 2;
  const buttonsPerRow = Math.max(
    2,
    Math.floor((availableWidth + gap) / (buttonWidth + gap))
  );

  if (isLoading) {
    return <FiaBookListSkeleton />;
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-center text-destructive">{error.message}</Text>
      </View>
    );
  }

  // Sort books in biblical order
  const sortedBooks = React.useMemo(() => sortBiblicalOrder(books), [books]);

  if (sortedBooks.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-muted-foreground">
          No FIA content available for this language.
        </Text>
      </View>
    );
  }

  const renderBookButton = (book: FiaBook) => {
    const bookExists = existingBookIds.has(book.id);
    const hasPericopes = book.pericopes.length > 0;
    const isDisabled = (!bookExists && !canCreateNew) || !hasPericopes;
    const iconSource = getFiaBookIcon(book.id);

    if (!bookExists && isDisabled && !hasPericopes) {
      // Still show faded books with 0 pericopes
    }

    return (
      <Button
        key={book.id}
        variant={bookExists ? 'outline' : 'ghost'}
        className={cn(
          'relative flex h-[140px] w-[110px] flex-col items-center justify-center gap-2 p-3',
          !bookExists && hasPericopes && 'border-dashed',
          (!hasPericopes || isDisabled) && 'opacity-30'
        )}
        onPress={() => onBookSelect(book.id)}
        disabled={isDisabled}
      >
        {iconSource ? (
          <Image
            source={iconSource}
            style={{
              width: 80,
              height: 80,
              tintColor: primaryColor
            }}
            resizeMode="contain"
          />
        ) : (
          <Icon as={BookOpenIcon} size={40} className="text-primary" />
        )}
        <View className="flex-col items-center gap-0.5">
          <Text
            className="text-center text-xs font-bold"
            style={{ letterSpacing: 0.5 }}
            numberOfLines={2}
          >
            {book.title}
          </Text>
          <Text className="text-xxs text-muted-foreground">
            {book.pericopes.length}
          </Text>
        </View>
        {!bookExists && canCreateNew && hasPericopes && (
          <Icon
            as={PlusCircleIcon}
            size={14}
            className="absolute -right-1 -top-1 text-primary"
          />
        )}
      </Button>
    );
  };

  return (
    <View className="mb-safe flex-1 gap-6">
      <LegendList
        data={sortedBooks}
        keyExtractor={(item) => item.id}
        numColumns={buttonsPerRow}
        estimatedItemSize={140}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{
          paddingHorizontal: padding,
          paddingBottom: 24
        }}
        recycleItems
        renderItem={({ item }) => renderBookButton(item)}
      />
    </View>
  );
}

export function FiaBookListSkeleton() {
  const screenWidth = Dimensions.get('window').width;
  const buttonWidth = 110;
  const gap = 12;
  const padding = 16;
  const availableWidth = screenWidth - padding * 2;
  const buttonsPerRow = Math.max(
    2,
    Math.floor((availableWidth + gap) / (buttonWidth + gap))
  );

  const skeletonBooks = Array.from({ length: 20 }, (_, i) => ({
    id: `skeleton-${i}`
  }));

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-start gap-3 p-4">
        <Skeleton className="rounded-lg" style={{ width: 48, height: 48 }} />
        <Skeleton className="rounded-lg" style={{ width: 200, height: 32 }} />
      </View>
      <LegendList
        data={skeletonBooks}
        keyExtractor={(item) => item.id}
        numColumns={buttonsPerRow}
        estimatedItemSize={140}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{
          paddingHorizontal: padding,
          paddingBottom: 24
        }}
        recycleItems
        renderItem={() => (
          <Skeleton
            className="rounded-lg"
            style={{ width: buttonWidth, height: 140 }}
          />
        )}
      />
    </View>
  );
}
