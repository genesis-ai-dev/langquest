import RecordingView from '@/views/new/RecordingView';
import { Stack } from 'expo-router';

export default function RecordingRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Recording' }} />
      <RecordingView />
    </>
  );
}
