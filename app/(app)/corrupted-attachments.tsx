import { useAuth } from '@/contexts/AuthContext';
import CorruptedAttachmentsView from '@/views/CorruptedAttachmentsView';
import { Redirect } from 'expo-router';

export default function CorruptedAttachmentsRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/" />;

  return <CorruptedAttachmentsView />;
}
