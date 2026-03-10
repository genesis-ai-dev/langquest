import RegisterView from '@/views/RegisterView';
import { Stack } from 'expo-router';

export default function RegisterScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Register' }} />
      <RegisterView />
    </>
  );
}
