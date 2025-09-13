import posthog from '@/services/posthog';
import { PostHogProvider as PostHogProviderBase } from 'posthog-react-native';

function PostHogProvider({ children }: { children: React.ReactNode }) {
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
