import { useAuth } from '@/contexts/AuthContext';
import CorruptedAttachmentsView from '@/views/CorruptedAttachmentsView';
import { Redirect, Stack } from 'expo-router';

export default function CorruptedAttachmentsRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/" />;

  return (
    <>
      <Stack.Screen options={{ title: 'Corrupted Attachments' }} />
      <CorruptedAttachmentsView />
    </>
  );
}
