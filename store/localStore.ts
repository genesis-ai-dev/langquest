import type { language } from '@/db/drizzleSchema';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Language = typeof language.$inferSelect;

interface RecentProject {
  id: string;
  name: string;
  lastAccessed: Date;
}

interface RecentQuest {
  id: string;
  name: string;
  projectId: string;
  lastAccessed: Date;
}

interface RecentAsset {
  id: string;
  name: string;
  questId: string;
  projectId: string;
  lastAccessed: Date;
}

interface LocalState {
  // UI Preferences
  languageId: string | null;
  language: Language | null;
  dateTermsAccepted: Date | null;
  analyticsOptOut: boolean;

  // Navigation History
  recentProjects: RecentProject[];
  recentQuests: RecentQuest[];
  recentAssets: RecentAsset[];

  // Filter preferences
  projectSourceFilter: string;
  projectTargetFilter: string;

  // Methods
  acceptTerms: () => void;
  setLanguage: (lang: Language | null) => void;
  setAnalyticsOptOut: (optOut: boolean) => void;
  addRecentProject: (project: Omit<RecentProject, 'lastAccessed'>) => void;
  addRecentQuest: (quest: Omit<RecentQuest, 'lastAccessed'>) => void;
  addRecentAsset: (asset: Omit<RecentAsset, 'lastAccessed'>) => void;
  setProjectSourceFilter: (filter: string) => void;
  setProjectTargetFilter: (filter: string) => void;
  clearNavigationHistory: () => void;
}

const MAX_RECENT_ITEMS = 10;

export const useLocalStore = create<LocalState>()(
  persist(
    (set) => ({
      // Initial state
      languageId: null,
      language: null,
      dateTermsAccepted: null,
      analyticsOptOut: false,
      recentProjects: [],
      recentQuests: [],
      recentAssets: [],
      projectSourceFilter: '',
      projectTargetFilter: '',

      // Methods
      acceptTerms: () => set({ dateTermsAccepted: new Date() }),

      setLanguage: (lang) =>
        set({
          language: lang,
          languageId: lang?.id || null
        }),

      setAnalyticsOptOut: (optOut) => set({ analyticsOptOut: optOut }),

      addRecentProject: (project) =>
        set((state) => {
          const newProject = { ...project, lastAccessed: new Date() };
          const filtered = state.recentProjects.filter(
            (p) => p.id !== project.id
          );
          return {
            recentProjects: [newProject, ...filtered].slice(0, MAX_RECENT_ITEMS)
          };
        }),

      addRecentQuest: (quest) =>
        set((state) => {
          const newQuest = { ...quest, lastAccessed: new Date() };
          const filtered = state.recentQuests.filter((q) => q.id !== quest.id);
          return {
            recentQuests: [newQuest, ...filtered].slice(0, MAX_RECENT_ITEMS)
          };
        }),

      addRecentAsset: (asset) =>
        set((state) => {
          const newAsset = { ...asset, lastAccessed: new Date() };
          const filtered = state.recentAssets.filter((a) => a.id !== asset.id);
          return {
            recentAssets: [newAsset, ...filtered].slice(0, MAX_RECENT_ITEMS)
          };
        }),

      setProjectSourceFilter: (filter) => set({ projectSourceFilter: filter }),

      setProjectTargetFilter: (filter) => set({ projectTargetFilter: filter }),

      clearNavigationHistory: () =>
        set({
          recentProjects: [],
          recentQuests: [],
          recentAssets: []
        })
    }),
    {
      name: 'langquest-local-storage',
      storage: {
        getItem: async (name) => {
          const value = await AsyncStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name, value) => {
          await AsyncStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async (name) => {
          await AsyncStorage.removeItem(name);
        }
      } as any,
      partialize: (state) => ({
        // Only persist these fields
        languageId: state.languageId,
        language: state.language,
        dateTermsAccepted: state.dateTermsAccepted,
        analyticsOptOut: state.analyticsOptOut,
        projectSourceFilter: state.projectSourceFilter,
        projectTargetFilter: state.projectTargetFilter
        // Don't persist navigation history - it should be fresh each session
      })
    }
  )
);
