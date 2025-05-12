import { useLocalStore } from '@/store/localStore';
import { PostHogProvider as PostHogProviderBase } from 'posthog-react-native';

function PostHogProvider({ children }: { children: React.ReactNode }) {
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const isAnalyticsOptedOut = useLocalStore((state) => state.analyticsOptOut);

  const defaultOptIn = !isAnalyticsOptedOut && !!dateTermsAccepted;
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
          !process.env.EXPO_PUBLIC_POSTHOG_HOST ||
          !process.env.EXPO_PUBLIC_POSTHOG_KEY
      }}
    >
      {children}
    </PostHogProviderBase>
  );
}

export default PostHogProvider;
