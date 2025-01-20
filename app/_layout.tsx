import React, { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Drawer } from '@/components/Drawer';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { usePathname } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSystem } from '../db/powersync/system';
import '../global.css';

export default function RootLayout() {
  const system = useSystem();
  const db = useMemo(() => {
    return system.powersync;
  }, []);
  const pathname = usePathname();
  const isGuarded = pathname === '/' || pathname === '/register';
  return (
    <AuthProvider>
      <ProjectProvider>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Drawer
              screenOptions={{
                headerShown: false,
                drawerType: 'slide',
                swipeEdgeWidth: 100,
                swipeEnabled: !isGuarded
              }}
            />
            {!isGuarded && <HamburgerMenu />}
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}
