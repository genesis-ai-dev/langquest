import { usePostHogAvailable } from '@/services/postHogAvailability';
import posthog, { initializePostHogWithStore } from '@/services/posthog';
import { PostHogProvider as PostHogProviderBase } from 'posthog-react-native';
import { useEffect } from 'react';

function PostHogProvider({ children }: { children: React.ReactNode }) {
  const postHogAvailable = usePostHogAvailable();

  useEffect(() => {
    const cleanup = initializePostHogWithStore();
    return () => {
      cleanup?.();
    };
  }, []);

  if (!postHogAvailable) {
    return children;
  }

  return (
    <PostHogProviderBase
      client={posthog}
      debug
      autocapture={{
        captureScreens: false
        // TODO: screen tracking has to be manually captured:
        // const posthog = usePostHog()
        // call the screen method within a useEffect callback
        // posthog.screen(pathname, params)
      }}
    >
      {children}
    </PostHogProviderBase>
  );
}

export default PostHogProvider;
