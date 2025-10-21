import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { BIBLE_BOOKS } from '@/constants/bibleStructure';
import { BOOK_ICON_MAP } from '@/utils/BOOK_GRAPHICS';
import { cn, useThemeColor } from '@/utils/styleUtils';
import { LegendList } from '@legendapp/list';
import { PlusCircleIcon } from 'lucide-react-native';
import React from 'react';
import { Dimensions, Image, View } from 'react-native';

interface BibleBookListProps {
  projectId: string;
  onBookSelect: (bookId: string) => void;
  existingBookIds?: Set<string>;
  canCreateNew?: boolean;
}

export function BibleBookList({
  projectId: _projectId,
  onBookSelect,
  existingBookIds,
  canCreateNew = false
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

  const renderBookButton = (
    book: { id: string; chapters: number },
    testament: 'old' | 'new'
  ) => {
    const iconSource = BOOK_ICON_MAP[book.id];
    const bookExists = existingBookIds?.has(book.id);
    const isDisabled = !bookExists && !canCreateNew;

    if (!bookExists && isDisabled) {
      return;
    }

    return (
      <Button
        key={book.id}
        variant={bookExists ? 'outline' : 'ghost'}
        className={cn(
          'relative flex h-[140px] w-[110px] flex-col items-center justify-center gap-2 p-3',
          !bookExists && 'border-dashed',
          isDisabled && 'opacity-30'
        )}
        onPress={() => onBookSelect(book.id)}
        disabled={isDisabled}
      >
        <Image
          source={iconSource}
          style={{
            width: 80,
            height: 80,
            tintColor: testament === 'old' ? primaryColor : secondaryColor
          }}
          resizeMode="contain"
        />
        <View className="flex-col items-center gap-0.5">
          <Text
            className="text-xs font-bold uppercase"
            style={{ letterSpacing: 0.5 }}
          >
            {book.id}
          </Text>
          <Text className="text-xxs text-muted-foreground">
            {book.chapters}
          </Text>
        </View>
        {/* Add plus icon for createable books */}
        {!bookExists && canCreateNew && (
          <Icon
            as={PlusCircleIcon}
            size={14}
            className="absolute -right-1 -top-1 text-primary"
          />
        )}
      </Button>
    );
  };

  // Combine all books with testament info
  const allBooks = [
    ...oldTestament.map((book) => ({ ...book, testament: 'old' as const })),
    ...newTestament.map((book) => ({ ...book, testament: 'new' as const }))
  ];

  return (
    <View className="mb-safe flex-1 gap-6">
      <LegendList
        data={allBooks}
        keyExtractor={(item) => (typeof item === 'string' ? item : item.id)}
        numColumns={buttonsPerRow}
        estimatedItemSize={140}
        columnWrapperStyle={{ gap: gap }}
        contentContainerStyle={{
          paddingHorizontal: padding,
          paddingBottom: 24
        }}
        recycleItems
        renderItem={({ item }) => renderBookButton(item, item.testament)}
        StickyHeaderComponent={() => (
          <View style={{ width: availableWidth, paddingVertical: 16 }}>
            <Skeleton style={{ width: 200, height: 24 }} />
          </View>
        )}
      />
    </View>
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

  // Create skeleton items (39 OT + 27 NT = 66 books)
  const skeletonBooks = Array.from({ length: 66 }, (_, i) => ({
    id: `skeleton-${i}`,
    testament: i < 39 ? ('old' as const) : ('new' as const)
  }));

  return (
    <View className="flex-1">
      <LegendList
        data={skeletonBooks}
        keyExtractor={(item) => item.id}
        numColumns={buttonsPerRow}
        estimatedItemSize={140}
        columnWrapperStyle={{ gap: gap }}
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
        ListHeaderComponent={
          <View style={{ width: availableWidth, paddingVertical: 16 }}>
            <Skeleton style={{ width: 200, height: 24 }} />
          </View>
        }
        // renderSectionHeader={(index) => {
        //   if (index === 39) {
        //     return (
        //       <View style={{ width: availableWidth, paddingVertical: 32 }}>
        //         <Skeleton style={{ width: 200, height: 24 }} />
        //       </View>
        //     );
        //   }
        //   return null;
        // }}
      />
    </View>
  );
}
