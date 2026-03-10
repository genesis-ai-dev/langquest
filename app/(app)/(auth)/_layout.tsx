import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/utils/styleUtils';
import { Stack, useRouter } from 'expo-router';
import { XIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/ui/icon';

export default function AuthLayout() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const backgroundColor = useThemeColor('background');

  useEffect(() => {
    if (isAuthenticated) {
      router.dismiss();
    }
  }, [isAuthenticated, router]);

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <View className="absolute right-4 top-4 z-[20]">
        <Pressable
          onPress={() => router.dismiss()}
          className="rounded-full bg-background/80 p-2"
          hitSlop={10}
        >
          <Icon as={XIcon} size={24} className="text-foreground" />
        </Pressable>
      </View>
      <Stack screenOptions={{ headerShown: false, animation: 'ios_from_right' }} />
    </View>
  );
}
