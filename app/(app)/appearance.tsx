import { useAuth } from '@/contexts/AuthContext';
import AppearanceView from '@/views/AppearanceView';
import { Redirect } from 'expo-router';

export default function AppearanceRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/" />;

  return <AppearanceView />;
}
