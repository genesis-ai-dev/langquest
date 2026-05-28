import { MigrationScreen } from '@/components/MigrationScreen';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MigrationRoute() {
  return (
    <SafeAreaView
      style={{ flex: 1 }}
      className="bg-background"
      edges={['top', 'left', 'right']}
    >
      <MigrationScreen />
    </SafeAreaView>
  );
}
