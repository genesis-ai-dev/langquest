import { isPostHogAvailable } from '@/services/postHogAvailability';
import posthog from '@/services/posthog.web';
import { PostHogProvider as PostHogProviderBase } from 'posthog-js/react';
import React from 'react';

// Instance initialization is handled in the web service file

function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!isPostHogAvailable()) {
    return <>{children}</>;
  }
  return <PostHogProviderBase client={posthog}>{children}</PostHogProviderBase>;
}

export default PostHogProvider;
