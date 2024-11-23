import { Stack } from "expo-router";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import "../global.css";

export default function RootLayout() {
  return (
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
  );
}
