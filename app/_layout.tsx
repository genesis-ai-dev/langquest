import { Drawer } from '@/components/Drawer';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Drawer />
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}
