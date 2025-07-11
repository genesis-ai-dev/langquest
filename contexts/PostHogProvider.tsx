import posthog from '@/services/posthog';
import { PostHogProvider as PostHogProviderBase } from 'posthog-react-native';

function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProviderBase client={posthog} debug>
      {children}
    </PostHogProviderBase>
  );
}

export default PostHogProvider;
