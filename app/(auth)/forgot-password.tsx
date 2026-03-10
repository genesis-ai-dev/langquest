import ForgotPasswordView from '@/views/ForgotPasswordView';
import { Stack } from 'expo-router';

export default function ForgotPasswordScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Forgot Password' }} />
      <ForgotPasswordView />
    </>
  );
}
