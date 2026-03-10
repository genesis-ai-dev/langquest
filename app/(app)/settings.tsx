import SettingsView from '@/views/SettingsView';
import { Stack } from 'expo-router';

export default function SettingsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <SettingsView />
    </>
  );
}
