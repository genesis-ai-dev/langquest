import { ANALYTICS_OPT_OUT_KEY } from '@/app/(root)/(drawer)/(stack)/profile';
import { useAcceptedTerms } from '@/hooks/useAcceptedTerms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PostHogProvider as PostHogProviderBase } from 'posthog-react-native';
import { useEffect, useState } from 'react';

function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [optedOut, setOptedOut] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const { termsAccepted, termsLoading } = useAcceptedTerms();

  useEffect(() => {
    AsyncStorage.getItem(ANALYTICS_OPT_OUT_KEY)
      .then((value) => {
        if (value) setOptedOut(Boolean(value));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  if (isLoading || termsLoading) {
    return null;
  }

  const defaultOptIn = !optedOut && termsAccepted;
  console.log('Has PostHog been opted in?', defaultOptIn);

  return (
    <PostHogProviderBase
      apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY ?? 'phc_'}
      debug
      options={{
        host: `${process.env.EXPO_PUBLIC_POSTHOG_HOST}/ingest`,
        enableSessionReplay: true,
        sessionReplayConfig: {
          maskAllImages: false,
          maskAllTextInputs: false
        },
        enablePersistSessionIdAcrossRestart: true,
        defaultOptIn,
        disabled:
          process.env.EXPO_PUBLIC_APP_VARIANT === 'development' ||
          process.env.EXPO_PUBLIC_POSTHOG_HOST === undefined ||
          process.env.EXPO_PUBLIC_POSTHOG_KEY === undefined
      }}
    >
      {children}
    </PostHogProviderBase>
  );
}

export default PostHogProvider;
