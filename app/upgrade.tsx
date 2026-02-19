import { AppUpgradeScreen } from '@/components/AppUpgradeScreen';
import { useAuth } from '@/contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UpgradeRoute() {
  const { upgradeError } = useAuth();

  if (!upgradeError) return null;

  return (
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
  );
}
