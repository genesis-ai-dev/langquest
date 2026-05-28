import { useAuth } from '@/contexts/AuthContext';
import RegisterView from '@/views/RegisterView';
import { Redirect } from 'expo-router';

export default function RegisterScreen() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Redirect href="/" />;

  return <RegisterView />;
}
