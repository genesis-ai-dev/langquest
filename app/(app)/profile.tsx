import ProfileView from '@/views/ProfileView';
import { Stack } from 'expo-router';

export default function ProfileRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Profile' }} />
      <ProfileView />
    </>
  );
}
