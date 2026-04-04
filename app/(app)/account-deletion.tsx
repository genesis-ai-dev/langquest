import { useAuth } from '@/contexts/AuthContext';
import AccountDeletionView from '@/views/AccountDeletionView';
import { Redirect, Stack } from 'expo-router';

export default function AccountDeletionRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/" />;

  return (
    <>
      <Stack.Screen options={{ title: 'Account Deletion' }} />
      <AccountDeletionView />
    </>
  );
}
