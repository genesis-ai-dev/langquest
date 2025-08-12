import type { BibleReference } from '@/constants/bibleStructure';
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
  creator_id?: string; // User ID of the creator
  private: boolean;
  visible: boolean;
  templates?: string[]; // Template IDs (e.g., ['every-language-bible'])
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

// Recording session types for RapidRecordingView
export interface AudioSegment {
  id: string;
  audioUri: string;
  startTime: number;
  endTime: number;
  duration: number;
  verse: BibleReference;
}

export interface RecordingSession {
  id: string;
  title: string;
  projectId: string;
  initialReference: BibleReference;
  segments: AudioSegment[];
  created_at: Date;
  last_updated: Date;
}

// Rabbit Mode types for draft session management
export interface RabbitModeSegment {
  id: string;
  assetId: string;
  startTime: number;
  endTime: number;
  duration: number;
  audioUri: string; // Semi-permanent file path
  waveformData?: number[];
  order: number; // For reordering
}

export interface RabbitModeAsset {
  id: string;
  name: string;
  segments: RabbitModeSegment[];
  isLocked: boolean; // UI affordance for tracking reviewed assets
  lockedAt?: Date;
}

export interface RabbitModeSession {
  id: string;
  questId: string;
  questName: string;
  projectId: string;
  assets: RabbitModeAsset[];
  created_at: Date;
  last_updated: Date;
  isCommitted: boolean;
  currentAssetId?: string; // Track which asset user is currently on
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

  // Recording sessions for RapidRecordingView
  recordingSessions: RecordingSession[];

  // Rabbit Mode draft sessions
  rabbitModeSessions: RabbitModeSession[];

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

  // Recording session methods
  getRecordingSession: (id: string) => RecordingSession | undefined;
  createRecordingSession: (id: string, title: string, projectId: string, initialReference: BibleReference) => void;
  addAudioSegment: (sessionId: string, segment: Omit<AudioSegment, 'id'>) => void;
  deleteAudioSegment: (sessionId: string, segmentId: string) => void;

  // Rabbit Mode session methods
  createRabbitModeSession: (questId: string, questName: string, projectId: string, assetIds: string[]) => string;
  addRabbitModeSegment: (sessionId: string, assetId: string, segment: Omit<RabbitModeSegment, 'id' | 'order'>) => void;
  deleteRabbitModeSegment: (sessionId: string, assetId: string, segmentId: string) => void;
  reorderRabbitModeSegments: (sessionId: string, assetId: string, segmentIds: string[]) => void;

  // Asset locking (UI affordance)
  lockAsset: (sessionId: string, assetId: string) => void;
  unlockAsset: (sessionId: string, assetId: string) => void;
  setCurrentAsset: (sessionId: string, assetId: string) => void;

  // Session lifecycle
  commitRabbitModeSession: (sessionId: string) => void;
  deleteRabbitModeSession: (sessionId: string) => void;
  getRabbitModeSession: (sessionId: string) => RabbitModeSession | undefined;
  getActiveRabbitModeSession: (questId: string) => RabbitModeSession | undefined;

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

      // Recording sessions for RapidRecordingView
      recordingSessions: [],

      // Rabbit Mode draft sessions
      rabbitModeSessions: [],

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

      // Recording session methods
      getRecordingSession: (id) => {
        const state = get();
        return state.recordingSessions.find((session) => session.id === id);
      },
      createRecordingSession: (id, title, projectId, initialReference) => {
        const now = new Date();
        const session: RecordingSession = {
          id,
          title,
          projectId,
          initialReference,
          segments: [],
          created_at: now,
          last_updated: now
        };
        set((state) => ({
          recordingSessions: [...state.recordingSessions, session]
        }));
      },
      addAudioSegment: (sessionId, segment) => {
        set((state) => ({
          recordingSessions: state.recordingSessions.map((session) =>
            session.id === sessionId
              ? {
                ...session,
                segments: [...session.segments, { ...segment, id: generateTempId() }],
                last_updated: new Date()
              }
              : session
          )
        }));
      },
      deleteAudioSegment: (sessionId, segmentId) => {
        set((state) => ({
          recordingSessions: state.recordingSessions.map((session) =>
            session.id === sessionId
              ? {
                ...session,
                segments: session.segments.filter((segment) => segment.id !== segmentId),
                last_updated: new Date()
              }
              : session
          )
        }));
      },

      // Rabbit Mode session methods
      createRabbitModeSession: (questId, questName, projectId, assetIds) => {
        const now = new Date();
        const sessionId = generateTempId();
        const session: RabbitModeSession = {
          id: sessionId,
          questId,
          questName,
          projectId,
          assets: assetIds.map(assetId => ({
            id: assetId,
            name: `Asset ${assetId}`, // TODO: Get actual asset name
            segments: [],
            isLocked: false
          })),
          created_at: now,
          last_updated: now,
          isCommitted: false,
          currentAssetId: assetIds[0] || undefined
        };

        set((state) => ({
          rabbitModeSessions: [...state.rabbitModeSessions, session]
        }));

        return sessionId;
      },

      addRabbitModeSegment: (sessionId, assetId, segment) => {
        set((state) => ({
          rabbitModeSessions: state.rabbitModeSessions.map((session) =>
            session.id === sessionId
              ? {
                ...session,
                assets: session.assets.map((asset) =>
                  asset.id === assetId
                    ? {
                      ...asset,
                      segments: [
                        ...asset.segments,
                        {
                          ...segment,
                          id: generateTempId(),
                          order: asset.segments.length
                        }
                      ]
                    }
                    : asset
                ),
                last_updated: new Date()
              }
              : session
          )
        }));
      },

      deleteRabbitModeSegment: (sessionId, assetId, segmentId) => {
        set((state) => ({
          rabbitModeSessions: state.rabbitModeSessions.map((session) =>
            session.id === sessionId
              ? {
                ...session,
                assets: session.assets.map((asset) =>
                  asset.id === assetId
                    ? {
                      ...asset,
                      segments: asset.segments
                        .filter((segment) => segment.id !== segmentId)
                        .map((segment, index) => ({ ...segment, order: index })) // Reorder after deletion
                    }
                    : asset
                ),
                last_updated: new Date()
              }
              : session
          )
        }));
      },

      reorderRabbitModeSegments: (sessionId, assetId, segmentIds) => {
        set((state) => ({
          rabbitModeSessions: state.rabbitModeSessions.map((session) =>
            session.id === sessionId
              ? {
                ...session,
                assets: session.assets.map((asset) =>
                  asset.id === assetId
                    ? {
                      ...asset,
                      segments: segmentIds
                        .map((id) => asset.segments.find((seg) => seg.id === id))
                        .filter((seg): seg is RabbitModeSegment => seg !== undefined)
                        .map((segment, index) => ({ ...segment, order: index }))
                    }
                    : asset
                ),
                last_updated: new Date()
              }
              : session
          )
        }));
      },

      lockAsset: (sessionId, assetId) => {
        set((state) => ({
          rabbitModeSessions: state.rabbitModeSessions.map((session) =>
            session.id === sessionId
              ? {
                ...session,
                assets: session.assets.map((asset) =>
                  asset.id === assetId
                    ? { ...asset, isLocked: true, lockedAt: new Date() }
                    : asset
                ),
                last_updated: new Date()
              }
              : session
          )
        }));
      },

      unlockAsset: (sessionId, assetId) => {
        set((state) => ({
          rabbitModeSessions: state.rabbitModeSessions.map((session) =>
            session.id === sessionId
              ? {
                ...session,
                assets: session.assets.map((asset) =>
                  asset.id === assetId
                    ? { ...asset, isLocked: false, lockedAt: undefined }
                    : asset
                ),
                last_updated: new Date()
              }
              : session
          )
        }));
      },

      setCurrentAsset: (sessionId, assetId) => {
        set((state) => ({
          rabbitModeSessions: state.rabbitModeSessions.map((session) =>
            session.id === sessionId
              ? { ...session, currentAssetId: assetId, last_updated: new Date() }
              : session
          )
        }));
      },

      commitRabbitModeSession: (sessionId) => {
        set((state) => ({
          rabbitModeSessions: state.rabbitModeSessions.map((session) =>
            session.id === sessionId
              ? { ...session, isCommitted: true, last_updated: new Date() }
              : session
          )
        }));
      },

      deleteRabbitModeSession: (sessionId) => {
        set((state) => ({
          rabbitModeSessions: state.rabbitModeSessions.filter(
            (session) => session.id !== sessionId
          )
        }));
      },

      getRabbitModeSession: (sessionId) => {
        const state = get();
        return state.rabbitModeSessions.find((session) => session.id === sessionId);
      },

      getActiveRabbitModeSession: (questId) => {
        const state = get();
        return state.rabbitModeSessions.find(
          (session) => session.questId === questId && !session.isCommitted
        );
      },

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
