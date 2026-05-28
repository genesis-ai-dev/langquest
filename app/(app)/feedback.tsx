import { useAuth } from '@/contexts/AuthContext';
import FeedbackView from '@/views/FeedbackView';
import { Redirect } from 'expo-router';

export default function FeedbackRoute() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Redirect href="/" />;

  return <FeedbackView />;
}
