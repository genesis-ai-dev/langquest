import { useAuth } from '@/contexts/AuthContext';
import NotificationsView from '@/views/NotificationsView';
import { Redirect } from 'expo-router';

export default function NotificationsRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/" />;

  return <NotificationsView />;
}
