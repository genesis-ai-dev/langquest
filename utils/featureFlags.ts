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

/**
 * Hook to get the project languoid suggestions feature flag from localStore
 */
export function useProjectLanguoidSuggestionsFeatureFlag() {
  return useLocalStore((state) => state.enableProjectLanguoidSuggestions);
}

/**
 * Get the project languoid suggestions feature flag value synchronously
 * (for use outside of React components)
 */
export function getProjectLanguoidSuggestionsFeatureFlag(): boolean {
  return useLocalStore.getState().enableProjectLanguoidSuggestions;
}
