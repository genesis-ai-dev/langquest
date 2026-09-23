import { useAuth } from '@/contexts/AuthContext';
import DownloadStatusView from '@/views/DownloadStatusView';
import { Redirect } from 'expo-router';

export default function DownloadStatusRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/" />;

  return <DownloadStatusView />;
}
