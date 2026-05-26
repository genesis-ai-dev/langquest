import { useLocalStore } from '@/store/localStore';

// Development configuration
// Toggle this to show/hide development UI elements
export const SHOW_DEV_ELEMENTS = false as boolean;

export const FEATURE_FLAG_SHOW_CREATE_NESTED_QUEST = false as boolean;

export const FEATURE_FLAG_CAN_OFFLOAD_QUEST = false as boolean;

export const FEATURE_FLAG_SHOW_FEEDBACK_EXPORT = false as boolean;

/**
 * Hook to get the project language suggestions feature flag from localStore
 */
export function useProjectLanguageSuggestionsFeatureFlag() {
  return useLocalStore((state) => state.enableProjectLanguageSuggestions);
}

/**
 * Get the project language suggestions feature flag value synchronously
 * (for use outside of React components)
 */
export function getProjectLanguageSuggestionsFeatureFlag(): boolean {
  return useLocalStore.getState().enableProjectLanguageSuggestions;
}
