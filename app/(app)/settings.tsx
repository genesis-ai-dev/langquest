import { useAuth } from '@/contexts/AuthContext';
import SettingsView from '@/views/SettingsView';
import { Redirect, Stack } from 'expo-router';

export default function SettingsRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/" />;

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <SettingsView />
    </>
  );
}
