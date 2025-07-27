import type { language, profile } from '@/db/drizzleSchema';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  | 'settings'
  | 'project-creation';

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

// Draft project and quest types
export interface DraftProject {
  id: string; // Temporary ID for draft
  name: string;
  description?: string;
  source_language_id: string;
  target_language_id: string;
  private: boolean;
  visible: boolean;
  created_at: Date;
  last_updated: Date;
}

export interface DraftQuest {
  id: string; // Temporary ID for draft
  project_id: string; // References draft project ID
  name: string;
  description?: string;
  visible: boolean;
  created_at: Date;
  last_updated: Date;
}

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

  // Draft projects and quests
  draftProjects: DraftProject[];
  draftQuests: DraftQuest[];

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

  // Draft project methods
  addDraftProject: (project: Omit<DraftProject, 'id' | 'created_at' | 'last_updated'>) => string;
  updateDraftProject: (id: string, updates: Partial<Omit<DraftProject, 'id' | 'created_at'>>) => void;
  removeDraftProject: (id: string) => void;
  getDraftProject: (id: string) => DraftProject | undefined;

  // Draft quest methods
  addDraftQuest: (quest: Omit<DraftQuest, 'id' | 'created_at' | 'last_updated'>) => string;
  updateDraftQuest: (id: string, updates: Partial<Omit<DraftQuest, 'id' | 'created_at'>>) => void;
  removeDraftQuest: (id: string) => void;
  getDraftQuestsByProjectId: (projectId: string) => DraftQuest[];
  removeDraftQuestsByProjectId: (projectId: string) => void;

  // Attachment sync methods
  setAttachmentSyncProgress: (
    progress: Partial<LocalState['attachmentSyncProgress']>
  ) => void;
  resetAttachmentSyncProgress: () => void;

  initialize: () => Promise<void>;
}

// Helper function to generate temporary IDs for drafts
const generateTempId = () => `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

      // Draft projects and quests
      draftProjects: [],
      draftQuests: [],

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

      // Draft project methods
      addDraftProject: (projectData) => {
        const id = generateTempId();
        const now = new Date();
        const draftProject: DraftProject = {
          ...projectData,
          id,
          created_at: now,
          last_updated: now
        };

        set((state) => ({
          draftProjects: [...state.draftProjects, draftProject]
        }));

        return id;
      },

      updateDraftProject: (id, updates) =>
        set((state) => ({
          draftProjects: state.draftProjects.map((project) =>
            project.id === id
              ? { ...project, ...updates, last_updated: new Date() }
              : project
          )
        })),

      removeDraftProject: (id) =>
        set((state) => {
          // Also remove associated draft quests
          const filteredQuests = state.draftQuests.filter(
            (quest) => quest.project_id !== id
          );
          return {
            draftProjects: state.draftProjects.filter(
              (project) => project.id !== id
            ),
            draftQuests: filteredQuests
          };
        }),

      getDraftProject: (id) => {
        const state = get();
        return state.draftProjects.find((project) => project.id === id);
      },

      // Draft quest methods
      addDraftQuest: (questData) => {
        const id = generateTempId();
        const now = new Date();
        const draftQuest: DraftQuest = {
          ...questData,
          id,
          created_at: now,
          last_updated: now
        };

        set((state) => ({
          draftQuests: [...state.draftQuests, draftQuest]
        }));

        return id;
      },

      updateDraftQuest: (id, updates) =>
        set((state) => ({
          draftQuests: state.draftQuests.map((quest) =>
            quest.id === id
              ? { ...quest, ...updates, last_updated: new Date() }
              : quest
          )
        })),

      removeDraftQuest: (id) =>
        set((state) => ({
          draftQuests: state.draftQuests.filter((quest) => quest.id !== id)
        })),

      getDraftQuestsByProjectId: (projectId) => {
        const state = get();
        return state.draftQuests.filter((quest) => quest.project_id === projectId);
      },

      removeDraftQuestsByProjectId: (projectId) =>
        set((state) => ({
          draftQuests: state.draftQuests.filter(
            (quest) => quest.project_id !== projectId
          )
        })),

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

// Initialize the language store at app startup
export const initializeLanguage = useLocalStore.getState().initialize;
