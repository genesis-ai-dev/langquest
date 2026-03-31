import { useAuth } from '@/contexts/AuthContext';
import SignInView from '@/views/SignInView';
import { Redirect, Stack } from 'expo-router';

export default function SignInScreen() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Sign In' }} />
      <SignInView />
    </>
  );
}
