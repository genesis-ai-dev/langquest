import { useAuth } from '@/contexts/AuthContext';
import ResetPasswordView from '@/views/ResetPasswordView';
import { Redirect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResetPasswordRoute() {
  const { isAuthenticated, sessionType } = useAuth();

  if (!isAuthenticated || sessionType !== 'password-reset') {
    return <Redirect href="/" />;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Reset Password' }} />
      <SafeAreaView
        style={{ flex: 1 }}
        className="bg-background"
        edges={['top', 'left', 'right']}
      >
        <ResetPasswordView />
      </SafeAreaView>
    </>
  );
}
