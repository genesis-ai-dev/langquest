import CorruptedAttachmentsView from '@/views/CorruptedAttachmentsView';
import { Stack } from 'expo-router';

export default function CorruptedAttachmentsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Corrupted Attachments' }} />
      <CorruptedAttachmentsView />
    </>
  );
}
