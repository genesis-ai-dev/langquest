import { useAuth } from '@/contexts/AuthProvider';
import { colors } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';

export default function AuthLayout() {
  const { isLoading, currentUser } = useAuth();

  if (isLoading) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color={colors.text} />
      </LinearGradient>
    );
  }

  if (!currentUser) {
    console.log('Redirecting to sign-in');
    return <Redirect href="/sign-in" />;
  }

  // Redirect to the new single-route app
  return <Redirect href="/app" />;
}
