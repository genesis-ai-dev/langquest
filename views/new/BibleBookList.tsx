import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { BIBLE_BOOKS } from '@/constants/bibleStructure';
import { BOOK_EMOJIS, BOOK_GRAPHICS } from '@/utils/BOOK_GRAPHICS';
import { useThemeColor } from '@/utils/styleUtils';
import React from 'react';
import { Dimensions, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

interface BibleBookListProps {
  projectId: string;
  onBookSelect: (bookId: string) => void;
}

interface BookButtonProps {
  book: {
    id: string;
    chapters: number;
  };
  onPress: (bookId: string) => void;
  variant?: 'ot' | 'nt';
  iconColor: string;
  useSvgIcons?: boolean;
}

const BookButton: React.FC<BookButtonProps> = React.memo(
  ({ book, onPress, iconColor, useSvgIcons = false }) => {
    const IconComponent = BOOK_GRAPHICS[book.id];
    const emoji = BOOK_EMOJIS[book.id] || '📖';
    const handlePress = React.useCallback(
      () => onPress(book.id),
      [book.id, onPress]
    );

    return (
      <Button
        key={book.id}
        variant="outline"
        className="flex h-[140px] w-[110px] flex-col items-center justify-center gap-2 p-3"
        onPress={handlePress}
      >
        {useSvgIcons && IconComponent ? (
          <IconComponent width={80} height={80} color={iconColor} />
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
  }
);

export function BibleBookList({
  projectId: _projectId,
  onBookSelect
}: BibleBookListProps) {
  const primaryColor = useThemeColor('primary');

  // Split into Old and New Testament
  const oldTestament = BIBLE_BOOKS.slice(0, 39);
  const newTestament = BIBLE_BOOKS.slice(39);

  // Use emojis by default for performance (set to true to enable SVG icons)
  const USE_SVG_ICONS = true;

  const handleBookPress = (bookId: string) => {
    console.log('Selected book:', bookId);
    onBookSelect(bookId);
  };

  // Calculate screen width for responsive centering
  const screenWidth = Dimensions.get('window').width;
  const buttonWidth = 110;
  const gap = 8;
  const padding = 16;
  const availableWidth = screenWidth - padding * 2;
  const buttonsPerRow = Math.floor(
    (availableWidth + gap) / (buttonWidth + gap)
  );
  const totalButtonWidth =
    buttonsPerRow * buttonWidth + (buttonsPerRow - 1) * gap;
  const leftPadding = (availableWidth - totalButtonWidth) / 2;

  return (
    <ScrollView className="flex-1">
      <View className="flex-col gap-6 p-4">
        {/* Old Testament */}
        <View className="flex-col gap-3">
          <Text variant="h4" className="mb-1">
            Old Testament
          </Text>
          <View
            className="flex-row flex-wrap"
            style={{
              gap: 8,
              justifyContent: 'flex-start',
              paddingLeft: leftPadding
            }}
          >
            {oldTestament.map((book) => (
              <BookButton
                key={book.id}
                book={book}
                onPress={handleBookPress}
                variant="ot"
                iconColor={primaryColor}
                useSvgIcons={USE_SVG_ICONS}
              />
            ))}
          </View>
        </View>

        {/* New Testament */}
        <View className="flex-col gap-3">
          <Text variant="h4" className="mb-1">
            New Testament
          </Text>
          <View
            className="flex-row flex-wrap"
            style={{
              gap: 8,
              justifyContent: 'flex-start',
              paddingLeft: leftPadding
            }}
          >
            {newTestament.map((book) => (
              <BookButton
                key={book.id}
                book={book}
                onPress={handleBookPress}
                variant="nt"
                iconColor={primaryColor}
                useSvgIcons={USE_SVG_ICONS}
              />
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
