import { AppUpgradeScreen } from '@/components/AppUpgradeScreen';
import { useAuth } from '@/contexts/AuthContext';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UpgradeRoute() {
  const { upgradeError } = useAuth();

  if (!upgradeError) return null;

  return (
    <>
      <Stack.Screen options={{ title: 'Upgrade' }} />
      <SafeAreaView
        style={{ flex: 1 }}
        className="bg-background"
        edges={['top', 'left', 'right']}
      >
        <AppUpgradeScreen
          localVersion={upgradeError.localVersion}
          serverVersion={upgradeError.serverVersion}
          reason={upgradeError.reason as 'server_ahead' | 'server_behind'}
        />
      </SafeAreaView>
    </>
  );
}
