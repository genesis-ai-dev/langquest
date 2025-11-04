import { useAuth } from '@/contexts/AuthContext';
import ResetPasswordView from '@/views/ResetPasswordView';
import { Redirect } from 'expo-router';

export default function ResetPasswordRoute() {
  const { sessionType, isLoading } = useAuth();

  // If still loading, show nothing (the auth context will handle the deep link)
  if (isLoading) {
    return null;
  }

  // If this is a password reset session, show the reset view
  if (sessionType === 'password-reset') {
    return <ResetPasswordView />;
  }

  // Otherwise redirect to the main app
  return <Redirect href="/" />;
}
