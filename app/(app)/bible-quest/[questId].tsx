import BibleAssetsView from '@/views/new/BibleAssetsView';
import { Stack } from 'expo-router';

export default function BibleQuestRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Quest' }} />
      <BibleAssetsView />
    </>
  );
}
