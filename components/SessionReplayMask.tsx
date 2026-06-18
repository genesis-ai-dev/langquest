import { PostHogMaskView } from 'posthog-react-native';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';

interface SessionReplayMaskProps extends ViewProps {
  /** When false, children render without masking. Defaults to true. */
  when?: boolean;
  children: ReactNode;
}

export function SessionReplayMask({
  when = true,
  children,
  ...viewProps
}: SessionReplayMaskProps) {
  if (!when) {
    return children;
  }

  return <PostHogMaskView {...viewProps}>{children}</PostHogMaskView>;
}
