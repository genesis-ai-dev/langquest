import posthog from '@/services/posthog.web';
import { PostHogProvider as PostHogProviderBase } from 'posthog-js/react';
import React from 'react';

function isDisabled() {
  return (
    process.env.EXPO_PUBLIC_APP_VARIANT === 'development' ||
    typeof __DEV__ !== 'undefined' ||
    !process.env.EXPO_PUBLIC_POSTHOG_HOST ||
    !process.env.EXPO_PUBLIC_POSTHOG_KEY
  );
}

// Instance initialization is handled in the web service file

function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (isDisabled()) {
    return <>{children}</>;
  }
  return <PostHogProviderBase client={posthog}>{children}</PostHogProviderBase>;
}

export default PostHogProvider;
