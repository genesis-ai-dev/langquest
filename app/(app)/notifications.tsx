import NotificationsView from '@/views/NotificationsView';
import { Stack } from 'expo-router';

export default function NotificationsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <NotificationsView />
    </>
  );
}
