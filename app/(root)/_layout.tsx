import PostHogProvider from '@/contexts/PostHogProvider';
import { useAcceptedTerms } from '@/hooks/useAcceptedTerms';
import { colors } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function TermsLayout() {
  const { termsAccepted, termsLoading } = useAcceptedTerms();

  if (termsLoading) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color={colors.text} />
      </LinearGradient>
    );
  }

  if (!termsAccepted) {
    console.log('redirecting to terms');
    return <Redirect href="/terms" />;
  }

  return (
    <PostHogProvider>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false
          }}
        />
      </SafeAreaProvider>
    </PostHogProvider>
  );
}
