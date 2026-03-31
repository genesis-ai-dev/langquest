import { useAuth } from '@/contexts/AuthContext';
import ResetPasswordView from '@/views/ResetPasswordView';
import { Redirect, Stack } from 'expo-router';

export default function ResetPasswordRoute() {
  const { isAuthenticated, sessionType } = useAuth();

  if (!isAuthenticated || sessionType !== 'password-reset') {
    return <Redirect href="/" />;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Reset Password' }} />
      <ResetPasswordView />
    </>
  );
}
