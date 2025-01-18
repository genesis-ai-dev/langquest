import React, { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSystem } from '../db/powersync/system';
import '../global.css';
import { Drawer } from '@/components/Drawer';

export default function RootLayout() {
  const system = useSystem();
  const db = useMemo(() => {
    return system.powersync;
  }, []);

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
