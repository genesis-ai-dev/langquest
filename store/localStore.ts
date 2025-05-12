import { languageService } from '@/database_services/languageService';
import type { language } from '@/db/drizzleSchema';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Language = typeof language.$inferSelect;

interface LocalState {
  languageId: string | null;
  language: Language | null;
  isLanguageLoading: boolean;
  dateTermsAccepted: Date | null;
  analyticsOptOut: boolean;
  setAnalyticsOptOut: (optOut: boolean) => void;
  acceptTerms: () => void;
  setLanguage: (lang: Language) => void;
  initialize: () => Promise<void>;
}

export const useLocalStore = create<LocalState>()(
  persist(
    (set, get) => ({
      languageId: null,
      language: null,
      isLanguageLoading: true,
      dateTermsAccepted: null,
      analyticsOptOut: false,
      setAnalyticsOptOut: (optOut: boolean) => set({ analyticsOptOut: optOut }),
      setLanguage: (lang: Language) =>
        set({ language: lang, languageId: lang.id }),
      acceptTerms: () => set({ dateTermsAccepted: new Date() }),

      initialize: async () => {
        const langId = get().languageId;
        if (langId) {
          const language = await languageService.getLanguageById(langId);
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
          Object.entries(state).filter(([key]) => !['language'].includes(key))
        )
    }
  )
);

// Initialize the language store at app startup
export const initializeLanguage = useLocalStore.getState().initialize;
