import type { language } from '@/db/drizzleSchema';
import type { Profile } from '@/hooks/db/useProfiles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Navigation types (forward declaration to avoid circular import)
export type AppView =
  | 'projects'
  | 'quests'
  | 'assets'
  | 'asset-detail'
  | 'profile'
  | 'notifications'
  | 'settings';

export interface NavigationStackItem {
  view: AppView;
  projectId?: string;
  projectName?: string;
  questId?: string;
  questName?: string;
  assetId?: string;
  assetName?: string;
  timestamp: number;
}

export type Language = typeof language.$inferSelect;

// Recently visited item types
export interface RecentProject {
  id: string;
  name: string;
  visitedAt: Date;
}

export interface RecentQuest {
  id: string;
  name: string;
  projectId: string;
  visitedAt: Date;
}

export interface RecentAsset {
  id: string;
  name: string;
  projectId: string;
  questId: string;
  visitedAt: Date;
}

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

  // Navigation context - just IDs, not full data
  currentProjectId: string | null;
  currentQuestId: string | null;
  currentAssetId: string | null;

  // State-driven navigation stack
  navigationStack: NavigationStackItem[];
  setNavigationStack: (stack: NavigationStackItem[]) => void;

  // Recently visited items (max 5 each)
  recentProjects: RecentProject[];
  recentQuests: RecentQuest[];
  recentAssets: RecentAsset[];

  // Attachment sync progress
  attachmentSyncProgress: {
    downloading: boolean;
    uploading: boolean;
  };

  setProjectSourceFilter: (filter: string) => void;
  setProjectTargetFilter: (filter: string) => void;
  setAnalyticsOptOut: (optOut: boolean) => void;
  acceptTerms: () => void;
  setLanguage: (lang: Language) => void;

  // Navigation context setters
  setCurrentContext: (
    projectId?: string,
    questId?: string,
    assetId?: string
  ) => void;
  clearCurrentContext: () => void;

  // Recently visited functions
  addRecentProject: (project: RecentProject) => void;
  addRecentQuest: (quest: RecentQuest) => void;
  addRecentAsset: (asset: RecentAsset) => void;

  // Attachment sync methods
  setAttachmentSyncProgress: (
    progress: Partial<LocalState['attachmentSyncProgress']>
  ) => void;
  resetAttachmentSyncProgress: () => void;

  initialize: () => Promise<void>;
}

export const useLocalStore = create<LocalState>()(
  persist(
    (set, _get) => ({
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),
      languageId: null,
      language: null,
      isLanguageLoading: true,
      dateTermsAccepted: null,
      analyticsOptOut: false,

      // Navigation context
      currentProjectId: null,
      currentQuestId: null,
      currentAssetId: null,

      // State-driven navigation stack
      navigationStack: [{ view: 'projects', timestamp: Date.now() }],
      setNavigationStack: (stack) => set({ navigationStack: stack }),

      // Recently visited items (max 5 each)
      recentProjects: [],
      recentQuests: [],
      recentAssets: [],

      // Attachment sync progress
      attachmentSyncProgress: {
        downloading: false,
        uploading: false
      },

      setAnalyticsOptOut: (optOut) => set({ analyticsOptOut: optOut }),
      setLanguage: (lang) => set({ language: lang, languageId: lang.id }),
      acceptTerms: () => set({ dateTermsAccepted: new Date() }),
      projectSourceFilter: 'All',
      projectTargetFilter: 'All',
      setProjectSourceFilter: (filter) => set({ projectSourceFilter: filter }),
      setProjectTargetFilter: (filter) => set({ projectTargetFilter: filter }),

      // Navigation context setters
      setCurrentContext: (projectId, questId, assetId) =>
        set({
          currentProjectId: projectId || null,
          currentQuestId: questId || null,
          currentAssetId: assetId || null
        }),
      clearCurrentContext: () =>
        set({
          currentProjectId: null,
          currentQuestId: null,
          currentAssetId: null
        }),

      // Recently visited functions
      addRecentProject: (project) =>
        set((state) => {
          const filtered = state.recentProjects.filter(
            (p) => p.id !== project.id
          );
          return { recentProjects: [project, ...filtered].slice(0, 5) };
        }),
      addRecentQuest: (quest) =>
        set((state) => {
          const filtered = state.recentQuests.filter((q) => q.id !== quest.id);
          return { recentQuests: [quest, ...filtered].slice(0, 5) };
        }),
      addRecentAsset: (asset) =>
        set((state) => {
          const filtered = state.recentAssets.filter((a) => a.id !== asset.id);
          return { recentAssets: [asset, ...filtered].slice(0, 5) };
        }),

      // Attachment sync methods
      setAttachmentSyncProgress: (progress) =>
        set((state) => ({
          attachmentSyncProgress: {
            ...state.attachmentSyncProgress,
            ...progress
          }
        })),
      resetAttachmentSyncProgress: () =>
        set({
          attachmentSyncProgress: {
            downloading: false,
            uploading: false
          }
        }),

      initialize: () => {
        console.log('initializing local store');
        // Language loading moved to app initialization to avoid circular dependency
        set({ isLanguageLoading: false });
        return Promise.resolve();
      }
    }),
    {
      name: 'local-store',
      storage: createJSONStorage(() => AsyncStorage),
      skipHydration: true,
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) =>
              ![
                'language',
                'currentUser',
                'currentProjectId',
                'currentQuestId',
                'currentAssetId',
                'navigationStack'
              ].includes(key)
          )
        )
    }
  )
);

// Initialize the language store at app startup
export const initializeLanguage = useLocalStore.getState().initialize;
