import AccountDeletionView from '@/views/AccountDeletionView';
import { Stack } from 'expo-router';

export default function AccountDeletionRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Account Deletion' }} />
      <AccountDeletionView />
    </>
  );
}
