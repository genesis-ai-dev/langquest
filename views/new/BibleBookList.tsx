import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { BIBLE_BOOKS } from '@/constants/bibleStructure';
import { BOOK_EMOJIS } from '@/utils/BOOK_EMOJIS';
import React from 'react';
import { View } from 'react-native';
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
}

const BookButton: React.FC<BookButtonProps> = ({ book, onPress }) => {
  const emoji = BOOK_EMOJIS[book.id] || '📖';

  return (
    <Button
      key={book.id}
      variant="outline"
      className="mb-3 flex w-[180px] flex-row items-center gap-3 px-5 py-4"
      onPress={() => onPress(book.id)}
      style={{
        justifyContent: 'flex-start'
      }}
    >
      <Text className="text-2xl">{emoji}</Text>
      <Text
        className="text-base font-semibold uppercase"
        style={{ letterSpacing: 1 }}
      >
        {book.id}
      </Text>
      <Text className="ml-auto text-xs text-muted-foreground">
        {book.chapters} ch
      </Text>
    </Button>
  );
};

export function BibleBookList({
  _projectId,
  onBookSelect
}: BibleBookListProps) {
  // Split into Old and New Testament
  const oldTestament = BIBLE_BOOKS.slice(0, 39);
  const newTestament = BIBLE_BOOKS.slice(39);

  const handleBookPress = (bookId: string) => {
    console.log('Selected book:', bookId);
    onBookSelect(bookId);
  };

  return (
    <ScrollView className="flex-1">
      <View className="flex-col gap-6 p-4">
        {/* Old Testament */}
        <View className="flex-col gap-3">
          <Text variant="h4">Old Testament</Text>
          <View
            className="flex-row flex-wrap"
            style={{
              gap: 12,
              justifyContent: 'flex-start'
            }}
          >
            {oldTestament.map((book) => (
              <BookButton
                key={book.id}
                book={book}
                onPress={handleBookPress}
                variant="ot"
              />
            ))}
          </View>
        </View>

        {/* New Testament */}
        <View className="flex-col gap-3">
          <Text variant="h4">New Testament</Text>
          <View className="flex-row flex-wrap gap-2">
            {newTestament.map((book) => (
              <BookButton
                key={book.id}
                book={book}
                onPress={handleBookPress}
                variant="nt"
              />
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
