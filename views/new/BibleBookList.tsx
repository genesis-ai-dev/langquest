import { Shimmer } from '@/components/Shimmer';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { BIBLE_BOOKS } from '@/constants/bibleStructure';
import { BOOK_EMOJIS, BOOK_ICON_MAP } from '@/utils/BOOK_GRAPHICS';
import { useThemeColor } from '@/utils/styleUtils';
import React from 'react';
import { Dimensions, Image, ScrollView, View } from 'react-native';

interface BibleBookListProps {
  projectId: string;
  onBookSelect: (bookId: string) => void;
}

// Skeleton loader for Bible book list
export const BibleBookListSkeleton = React.memo(() => {
  // Match responsive layout from BibleBookList
  const screenWidth = Dimensions.get('window').width;
  const buttonWidth = 110;
  const buttonHeight = 140;
  const gap = 12;
  const padding = 16;
  const availableWidth = screenWidth - padding * 2;
  const buttonsPerRow = Math.max(
    2,
    Math.floor((availableWidth + gap) / (buttonWidth + gap))
  );

  // Render a skeleton book button
  const renderSkeletonButton = (key: string) => (
    <View
      key={key}
      className="flex h-[140px] w-[110px] flex-col items-center justify-center gap-2 rounded-md border border-border bg-card p-3"
    >
      {/* Icon */}
      <Shimmer width={80} height={80} borderRadius={8} />
      {/* Book name */}
      <Shimmer width={60} height={12} borderRadius={4} />
      {/* Chapter count */}
      <Shimmer width={40} height={10} borderRadius={4} />
    </View>
  );

  // Render a row of skeleton buttons
  const renderSkeletonRow = (count: number, rowKey: string) => (
    <View
      key={rowKey}
      style={{
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: gap,
        marginBottom: gap
      }}
    >
      {Array.from({ length: count }, (_, i) =>
        renderSkeletonButton(`${rowKey}-${i}`)
      )}
    </View>
  );

  // Calculate rows for Old Testament (39 books) and New Testament (27 books)
  const oldTestamentRows = Math.ceil(39 / buttonsPerRow);
  const newTestamentRows = Math.ceil(27 / buttonsPerRow);

  return (
    <ScrollView
      contentContainerStyle={{
        alignItems: 'center',
        paddingHorizontal: padding,
        paddingBottom: 24
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Old Testament section */}
      <View style={{ width: availableWidth, paddingVertical: 16 }}>
        <Shimmer width={180} height={24} borderRadius={8} />
      </View>
      {Array.from({ length: oldTestamentRows }, (_, i) =>
        renderSkeletonRow(
          i === oldTestamentRows - 1
            ? 39 % buttonsPerRow || buttonsPerRow
            : buttonsPerRow,
          `old-${i}`
        )
      )}

      {/* New Testament section */}
      <View style={{ width: availableWidth, paddingVertical: 32 }}>
        <Shimmer width={180} height={24} borderRadius={8} />
      </View>
      {Array.from({ length: newTestamentRows }, (_, i) =>
        renderSkeletonRow(
          i === newTestamentRows - 1
            ? 27 % buttonsPerRow || buttonsPerRow
            : buttonsPerRow,
          `new-${i}`
        )
      )}
    </ScrollView>
  );
});

export function BibleBookList({
  projectId: _projectId,
  onBookSelect
}: BibleBookListProps) {
  const primaryColor = useThemeColor('primary');
  const secondaryColor = useThemeColor('chart-2');

  // Responsive: calculate how many fit per row
  const screenWidth = Dimensions.get('window').width;
  const buttonWidth = 110;
  const gap = 12;
  const padding = 16;
  const availableWidth = screenWidth - padding * 2;
  const buttonsPerRow = Math.max(
    2,
    Math.floor((availableWidth + gap) / (buttonWidth + gap))
  );

  // Split books
  const oldTestament = BIBLE_BOOKS.slice(0, 39);
  const newTestament = BIBLE_BOOKS.slice(39);

  // Helper to chunk books into rows
  function chunkBooks(books: typeof BIBLE_BOOKS, size: number) {
    const rows = [];
    for (let i = 0; i < books.length; i += size) {
      rows.push(books.slice(i, i + size));
    }
    return rows;
  }

  const renderBookButton = (
    book: { id: string; chapters: number },
    testament: 'old' | 'new'
  ) => {
    const emoji = BOOK_EMOJIS[book.id] || '📖';
    const iconSource = BOOK_ICON_MAP[book.id];

    return (
      <Button
        key={book.id}
        variant="outline"
        className="flex h-[140px] w-[110px] flex-col items-center justify-center gap-2 p-3"
        onPress={() => onBookSelect(book.id)}
      >
        {iconSource ? (
          <Image
            source={iconSource}
            style={{
              width: 80,
              height: 80,
              tintColor: testament === 'old' ? primaryColor : secondaryColor
            }}
            resizeMode="contain"
          />
        ) : (
          <Text className="text-4xl">{emoji}</Text>
        )}
        <View className="flex-col items-center gap-0.5">
          <Text
            className="text-xs font-bold uppercase"
            style={{ letterSpacing: 0.5 }}
          >
            {book.id}
          </Text>
          <Text className="text-[10px] text-muted-foreground">
            {book.chapters} ch
          </Text>
        </View>
      </Button>
    );
  };

  const renderBookRows = (
    books: typeof BIBLE_BOOKS,
    testament: 'old' | 'new'
  ) => {
    const rows = chunkBooks(books, buttonsPerRow);
    return rows.map((row, idx) => (
      <View
        key={idx}
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-start',
          gap: gap,
          marginBottom: gap
        }}
      >
        {row.map((book) => renderBookButton(book, testament))}
      </View>
    ));
  };

  return (
    <ScrollView
      contentContainerStyle={{
        alignItems: 'center',
        paddingHorizontal: padding,
        paddingBottom: 24
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ width: availableWidth, paddingVertical: 16 }}>
        <Text variant="h4" className="text-center">
          Old Testament
        </Text>
      </View>
      {renderBookRows(oldTestament, 'old')}
      <View style={{ width: availableWidth, paddingVertical: 32 }}>
        <Text variant="h4" className="text-center">
          New Testament
        </Text>
      </View>
      {renderBookRows(newTestament, 'new')}
    </ScrollView>
  );
}
