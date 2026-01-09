import { useLocalStore } from '@/store/localStore';

// Development configuration
// Toggle this to show/hide development UI elements
export const SHOW_DEV_ELEMENTS = false as boolean;

export const FEATURE_FLAG_SHOW_CREATE_NESTED_QUEST = false as boolean;

export const FEATURE_FLAG_CAN_OFFLOAD_QUEST = false as boolean;

export const FEATURE_FLAG_SHOW_FEEDBACK_EXPORT = false as boolean;

/**
 * Hook to get the languoid link suggestions feature flag from localStore
 */
export function useLanguoidLinkSuggestionsFeatureFlag() {
  return useLocalStore((state) => state.enableLanguoidLinkSuggestions);
}

/**
 * Get the languoid link suggestions feature flag value synchronously
 * (for use outside of React components)
 */
export function getLanguoidLinkSuggestionsFeatureFlag(): boolean {
  return useLocalStore.getState().enableLanguoidLinkSuggestions;
}
