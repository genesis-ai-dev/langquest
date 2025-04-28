import { ANALYTICS_OPT_OUT_KEY } from '@/app/(drawer)/(stack)/profile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PostHogProvider as PostHogProviderBase } from 'posthog-react-native';
import { useEffect, useState } from 'react';

function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <PostHog>{children}</PostHog>;
}

function PostHog({ children }: { children: React.ReactNode }) {
  const [optedIn, setOptedIn] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(ANALYTICS_OPT_OUT_KEY)
      .then((value) => {
        setOptedIn(value);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return null;
  }

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
        defaultOptIn: optedIn === 'false',
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
