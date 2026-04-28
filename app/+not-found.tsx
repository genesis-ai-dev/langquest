import { Text } from '@/components/ui/text';
import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center bg-background p-5">
        <Text variant="h3">Page not found</Text>
        <Link href="/" className="mt-4 py-4">
          <Text className="text-primary underline">Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}
