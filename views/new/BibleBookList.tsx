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

export function BibleBookList({ projectId, onBookSelect }: BibleBookListProps) {
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
            {oldTestament.map((book, idx) => {
              const emoji = BOOK_EMOJIS[book.id] || '📖';
              return (
                <View
                  key={book.id}
                  style={{
                    width: 104,
                    marginBottom: 12,
                    alignItems: 'center'
                  }}
                >
                  <Button
                    variant="outline"
                    className="h-content w-full flex-col items-center justify-center gap-1 p-6"
                    onPress={() => handleBookPress(book.id)}
                  >
                    <Text
                      className="text-center text-2xl"
                      style={{ marginBottom: 4 }}
                    >
                      {emoji}
                    </Text>
                    <Text
                      className="text-center text-xs font-semibold uppercase"
                      style={{ letterSpacing: 1, marginBottom: 1 }}
                    >
                      {book.id}{' '}
                      <Text className="text-xs text-muted-foreground">
                        ({book.chapters})
                      </Text>
                    </Text>
                  </Button>
                </View>
              );
            })}
          </View>
        </View>

        {/* New Testament */}
        <View className="flex-col gap-3">
          <Text variant="h4">New Testament</Text>
          <View className="flex-row flex-wrap gap-2">
            {newTestament.map((book) => {
              const emoji = BOOK_EMOJIS[book.id] || '📖';
              return (
                <Button
                  key={book.id}
                  variant="outline"
                  className="w-[110px] flex-col gap-1 py-3"
                  onPress={() => handleBookPress(book.id)}
                >
                  <Text className="text-2xl">{emoji}</Text>
                  <Text className="text-xs font-semibold uppercase">
                    {book.id}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {book.chapters} ch
                  </Text>
                </Button>
              );
            })}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
