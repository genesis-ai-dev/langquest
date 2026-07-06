/** Web PostHog is disabled; native-only analytics for now. */

const noopPostHog = {
  capture: () => undefined,
  identify: () => undefined,
  reset: () => undefined,
  optIn: async () => undefined,
  optOut: async () => undefined,
  register: async () => undefined
};

export const syncPostHogIdentity = async () => undefined;

export const setPostHogUserId = (_userId: string | null) => undefined;

export const initializePostHogWithStore = () => undefined;

export const applyPostHogCaptureState = async () => undefined;

export { noopPostHog as posthog };
export default noopPostHog;
