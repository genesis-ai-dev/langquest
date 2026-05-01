import { useAuth } from '@/contexts/AuthContext';
import ForgotPasswordView from '@/views/ForgotPasswordView';
import { Redirect, Stack } from 'expo-router';

export default function ForgotPasswordScreen() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Redirect href="/" />;

  return (
    <>
      <Stack.Screen options={{ title: 'Forgot Password' }} />
      <ForgotPasswordView />
    </>
  );
}
