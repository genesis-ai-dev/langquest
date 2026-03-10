import DownloadStatusView from '@/views/DownloadStatusView';
import { Stack } from 'expo-router';

export default function DownloadStatusRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Download Status' }} />
      <DownloadStatusView />
    </>
  );
}
