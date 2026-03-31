import { cn } from '@/utils/styleUtils';
import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function AuthLayout() {
  return (
    <View className={cn('flex-1 bg-background')}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
