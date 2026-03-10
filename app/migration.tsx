import { MigrationScreen } from '@/components/MigrationScreen';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MigrationRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Migration' }} />
      <SafeAreaView
        style={{ flex: 1 }}
        className="bg-background"
        edges={['top', 'left', 'right']}
      >
        <MigrationScreen />
      </SafeAreaView>
    </>
  );
}
