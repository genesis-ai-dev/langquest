import { useAuth } from '@/contexts/AuthContext';
import RegisterView from '@/views/RegisterView';
import { Redirect, Stack } from 'expo-router';

export default function RegisterScreen() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Register' }} />
      <RegisterView />
    </>
  );
}
