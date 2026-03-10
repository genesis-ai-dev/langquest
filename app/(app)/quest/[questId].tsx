import NextGenAssetsView from '@/views/new/NextGenAssetsView';
import { Stack } from 'expo-router';

export default function QuestRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Quest' }} />
      <NextGenAssetsView />
    </>
  );
}
