import NextGenAssetDetailView from '@/views/new/NextGenAssetDetailView';
import { Stack } from 'expo-router';

export default function AssetRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Asset' }} />
      <NextGenAssetDetailView />
    </>
  );
}
