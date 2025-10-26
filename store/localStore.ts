import type { language, profile } from '@/db/drizzleSchema';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Profile = typeof profile.$inferSelect;
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
  projectTemplate?: string | null;
  bookId?: string; // For Bible projects - which book is being viewed
  questId?: string;
  questName?: string;
  assetId?: string;
  assetName?: string;
  timestamp: number;
}

export type Language = typeof language.$inferSelect;
export type Theme = 'light' | 'dark' | 'system';

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

export interface LocalState {
  systemReady: boolean;
  setSystemReady: (ready: boolean) => void;
  currentUser: Profile | null;
  setCurrentUser: (user: Profile | null) => void;
  uiLanguage: Language | null;
  savedLanguage: Language | null;
  dateTermsAccepted: Date | null;
  analyticsOptOut: boolean;
  projectSourceFilter: string;
  projectTargetFilter: string;

  // App settings
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  downloadOnWifiOnly: boolean;
  setDownloadOnWifiOnly: (wifiOnly: boolean) => void;
  autoBackup: boolean;
  setAutoBackup: (enabled: boolean) => void;
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
  showHiddenContent: boolean;
  setShowHiddenContent: (show: boolean) => void;

  // VAD (Voice Activity Detection) settings
  // vadThreshold: 0.005-0.1 (lower = more sensitive, picks up quiet speech)
  // vadSilenceDuration: 500-3000ms (how long to wait before stopping recording)
  vadThreshold: number;
  setVadThreshold: (threshold: number) => void;
  vadSilenceDuration: number;
  setVadSilenceDuration: (duration: number) => void;

  // Authentication view state
  authView:
    | 'sign-in'
    | 'register'
    | 'forgot-password'
    | 'reset-password'
    | null;
  setAuthView: (
    view: 'sign-in' | 'register' | 'forgot-password' | 'reset-password' | null
  ) => void;

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
    downloadCurrent: number;
    downloadTotal: number;
    uploadCurrent: number;
    uploadTotal: number;
  };

  setProjectSourceFilter: (filter: string) => void;
  setProjectTargetFilter: (filter: string) => void;
  setAnalyticsOptOut: (optOut: boolean) => void;
  acceptTerms: () => void;
  setUILanguage: (lang: Language) => void;
  setSavedLanguage: (lang: Language) => void;

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

  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useLocalStore = create<LocalState>()(
  persist(
    (set, _get) => ({
      systemReady: false,
      setSystemReady: (ready) => set({ systemReady: ready }),

      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),
      uiLanguage: null,
      savedLanguage: null,
      dateTermsAccepted: null,
      analyticsOptOut: false,
      theme: 'system',

      // App settings (defaults)
      notificationsEnabled: true,
      downloadOnWifiOnly: true,
      autoBackup: false,
      debugMode: false,
      showHiddenContent: false,

      // VAD settings (defaults)
      vadThreshold: 0.03, // Normal sensitivity
      vadSilenceDuration: 1000, // 1 second pause

      // Authentication view state
      authView: null,
      setAuthView: (view) => set({ authView: view }),

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
        uploading: false,
        downloadCurrent: 0,
        downloadTotal: 0,
        uploadCurrent: 0,
        uploadTotal: 0
      },

      setAnalyticsOptOut: (optOut) => set({ analyticsOptOut: optOut }),
      setTheme: (theme) => {
        set({ theme });
        colorScheme.set(theme);
      },
      setUILanguage: (lang) => set({ uiLanguage: lang }),
      setSavedLanguage: (lang) => set({ savedLanguage: lang }),
      acceptTerms: () => set({ dateTermsAccepted: new Date() }),
      projectSourceFilter: 'All',
      projectTargetFilter: 'All',
      setProjectSourceFilter: (filter) => set({ projectSourceFilter: filter }),
      setProjectTargetFilter: (filter) => set({ projectTargetFilter: filter }),

      // Settings setters
      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),
      setDownloadOnWifiOnly: (wifiOnly) =>
        set({ downloadOnWifiOnly: wifiOnly }),
      setAutoBackup: (enabled) => set({ autoBackup: enabled }),
      setDebugMode: (enabled) => set({ debugMode: enabled }),
      setShowHiddenContent: (show) => set({ showHiddenContent: show }),

      // VAD settings setters
      setVadThreshold: (threshold) => set({ vadThreshold: threshold }),
      setVadSilenceDuration: (duration) =>
        set({ vadSilenceDuration: duration }),

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
            uploading: false,
            downloadCurrent: 0,
            downloadTotal: 0,
            uploadCurrent: 0,
            uploadTotal: 0
          }
        })
    }),
    {
      name: 'local-store',
      storage: createJSONStorage(() => AsyncStorage),
      // skipHydration: true,
      onRehydrateStorage: () => (state) => {
        console.log('rehydrating local store', state);
        if (state) colorScheme.set(state.theme);
      },
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) =>
              ![
                'systemReady',
                'currentUser', // I don't think we're getting this from the local store any more
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
