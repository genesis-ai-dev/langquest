import SignInView from '@/views/SignInView';
import { Stack } from 'expo-router';

export default function SignInScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Sign In' }} />
      <SignInView />
    </>
  );
}
