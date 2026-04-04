import { useAuth } from '@/contexts/AuthContext';
import SignInView from '@/views/SignInView';
import { Redirect } from 'expo-router';

export default function SignInScreen() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Redirect href="/" />;

  return <SignInView />;
}
