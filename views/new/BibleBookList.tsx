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

export function BibleBookListSkeleton() {
  const screenWidth = Dimensions.get('window').width;
  const buttonWidth = 110;
  const gap = 12;
  const padding = 16;
  const availableWidth = screenWidth - padding * 2;
  const buttonsPerRow = Math.max(
    2,
    Math.floor((availableWidth + gap) / (buttonWidth + gap))
  );

  // Create a few rows of skeleton buttons
  const renderSkeletonRow = (rowIndex: number) => {
    const buttons = [];
    for (let i = 0; i < buttonsPerRow; i++) {
      buttons.push(
        <Shimmer
          key={`skeleton-${rowIndex}-${i}`}
          width={buttonWidth}
          height={140}
          borderRadius={8}
        />
      );
    }
    return (
      <View
        key={rowIndex}
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-start',
          gap: gap,
          marginBottom: gap
        }}
      >
        {buttons}
      </View>
    );
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
        <Shimmer width={200} height={24} borderRadius={4} />
      </View>
      {[0, 1, 2, 3].map(renderSkeletonRow)}
      <View style={{ width: availableWidth, paddingVertical: 32 }}>
        <Shimmer width={200} height={24} borderRadius={4} />
      </View>
      {[4, 5, 6].map(renderSkeletonRow)}
    </ScrollView>
  );
}
