import PostHogProvider from '@/contexts/PostHogProvider';
import { useAcceptedTerms } from '@/hooks/useAcceptedTerms';
import { Redirect, Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function TermsLayout() {
  const { termsAccepted, termsLoading } = useAcceptedTerms();

  if (!termsAccepted && !termsLoading) {
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
