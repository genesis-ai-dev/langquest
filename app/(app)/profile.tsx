import { useAuth } from '@/contexts/AuthContext';
import ProfileView from '@/views/ProfileView';
import { Redirect } from 'expo-router';

export default function ProfileRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/" />;

  return <ProfileView />;
}
