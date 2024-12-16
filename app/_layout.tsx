import { Stack } from "expo-router";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import React, { useEffect, useMemo } from 'react';

import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import "../global.css";
import {useSystem} from "../db/powersync/system";
import { PowerSyncContext } from "@powersync/react-native";
export default function RootLayout() {
  const system = useSystem();
  const db = useMemo(() => {
    return system.powersync;
  }, []);

  return (
    <PowerSyncContext.Provider value={db}>
      <AuthProvider>
        <ProjectProvider>
          <SafeAreaProvider>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="register" options={{ headerShown: false }} />
              <Stack.Screen name="projects" options={{ headerShown: false }} />
              <Stack.Screen name="quests" options={{ headerShown: false }} />
              <Stack.Screen name="assets" options={{ headerShown: false }} />
              <Stack.Screen name="assetView" options={{ headerShown: false }}
              />
            </Stack>
          </SafeAreaProvider>
        </ProjectProvider>
      </AuthProvider>
    </PowerSyncContext.Provider>
  );
}
