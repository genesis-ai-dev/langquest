import { useAuth } from '@/contexts/AuthContext';
import AccountDeletionView from '@/views/AccountDeletionView';
import { Redirect } from 'expo-router';

export default function AccountDeletionRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/" />;

  return <AccountDeletionView />;
}
