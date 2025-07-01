import type { language } from '@/db/drizzleSchema';
import { getLanguageById } from '@/hooks/db/useLanguages';
import type { Profile } from '@/hooks/db/useProfiles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Language = typeof language.$inferSelect;

interface LocalState {
  currentUser: Profile | null;
  setCurrentUser: (user: Profile | null) => void;
  languageId: string | null;
  language: Language | null;
  isLanguageLoading: boolean;
  dateTermsAccepted: Date | null;
  analyticsOptOut: boolean;
  projectSourceFilter: string;
  projectTargetFilter: string;
  setProjectSourceFilter: (filter: string) => void;
  setProjectTargetFilter: (filter: string) => void;
  setAnalyticsOptOut: (optOut: boolean) => void;
  acceptTerms: () => void;
  setLanguage: (lang: Language) => void;
  initialize: () => Promise<void>;
}

export const useLocalStore = create<LocalState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),
      languageId: null,
      language: null,
      isLanguageLoading: true,
      dateTermsAccepted: null,
      analyticsOptOut: false,
      setAnalyticsOptOut: (optOut) => set({ analyticsOptOut: optOut }),
      setLanguage: (lang) => set({ language: lang, languageId: lang.id }),
      acceptTerms: () => set({ dateTermsAccepted: new Date() }),
      projectSourceFilter: 'All',
      projectTargetFilter: 'All',
      setProjectSourceFilter: (filter) => set({ projectSourceFilter: filter }),
      setProjectTargetFilter: (filter) => set({ projectTargetFilter: filter }),

      initialize: async () => {
        console.log('initializing local store');
        const langId = get().languageId;
        if (langId) {
          const language = await getLanguageById(langId);
          set({ language, isLanguageLoading: false });
        }
      }
    }),
    {
      name: 'local-store',
      storage: createJSONStorage(() => AsyncStorage),
      skipHydration: true,
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) => !['language', 'currentUser'].includes(key)
          )
        )
    }
  )
);

// Initialize the language store at app startup
export const initializeLanguage = useLocalStore.getState().initialize;
