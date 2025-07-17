import type { BibleReference } from '@/constants/bibleStructure';
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

// Bible recording types
export interface AudioSegment {
  id: string;
  questId: string;
  audioUri: string;
  startTime: number;
  endTime: number;
  duration: number;
  verse: BibleReference;
  createdAt: number;
  order: number; // For drag and drop ordering
}

export interface AssetMarker {
  id: string;
  questId: string;
  title: string;
  position: number; // Position in the segments array
  createdAt: number;
  order: number; // For drag and drop ordering
}

export interface BibleRecordingSession {
  id: string;
  questId: string;
  questName: string;
  projectId: string;
  startedAt: number;
  lastModified: number;
  currentVerse: BibleReference;
  segments: AudioSegment[];
  markers: AssetMarker[];
  isRecording: boolean;
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
    downloadCurrent: number;
    downloadTotal: number;
    uploadCurrent: number;
    uploadTotal: number;
  };

  // Bible recording sessions
  bibleRecordingSessions: Record<string, BibleRecordingSession>;

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

  // Bible recording methods
  createRecordingSession: (
    questId: string,
    questName: string,
    projectId: string,
    initialVerse: BibleReference
  ) => BibleRecordingSession;
  getRecordingSession: (questId: string) => BibleRecordingSession | null;
  updateRecordingSession: (questId: string, updates: Partial<BibleRecordingSession>) => void;
  deleteRecordingSession: (questId: string) => void;

  // Segment management
  addAudioSegment: (questId: string, segment: Omit<AudioSegment, 'id' | 'questId' | 'createdAt' | 'order'>) => void;
  updateAudioSegment: (questId: string, segmentId: string, updates: Partial<AudioSegment>) => void;
  deleteAudioSegment: (questId: string, segmentId: string) => void;
  reorderAudioSegments: (questId: string, fromIndex: number, toIndex: number) => void;

  // Marker management
  addAssetMarker: (questId: string, marker: Omit<AssetMarker, 'id' | 'questId' | 'createdAt' | 'order'>) => void;
  updateAssetMarker: (questId: string, markerId: string, updates: Partial<AssetMarker>) => void;
  deleteAssetMarker: (questId: string, markerId: string) => void;
  reorderAssetMarkers: (questId: string, fromIndex: number, toIndex: number) => void;

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

      // Bible recording sessions
      bibleRecordingSessions: {},

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
            uploading: false,
            downloadCurrent: 0,
            downloadTotal: 0,
            uploadCurrent: 0,
            uploadTotal: 0
          }
        }),

      // Bible recording methods
      createRecordingSession: (questId, questName, projectId, initialVerse) => {
        const session: BibleRecordingSession = {
          id: `session-${questId}-${Date.now()}`,
          questId,
          questName,
          projectId,
          startedAt: Date.now(),
          lastModified: Date.now(),
          currentVerse: initialVerse,
          segments: [],
          markers: [],
          isRecording: false
        };

        set((state) => ({
          bibleRecordingSessions: {
            ...state.bibleRecordingSessions,
            [questId]: session
          }
        }));

        return session;
      },

      getRecordingSession: (questId) => {
        const state = get();
        return state.bibleRecordingSessions[questId] || null;
      },

      updateRecordingSession: (questId, updates) => {
        set((state) => {
          const existingSession = state.bibleRecordingSessions[questId];
          if (!existingSession) return state;

          return {
            bibleRecordingSessions: {
              ...state.bibleRecordingSessions,
              [questId]: {
                ...existingSession,
                ...updates,
                lastModified: Date.now()
              }
            }
          };
        });
      },

      deleteRecordingSession: (questId) => {
        set((state) => {
          const { [questId]: _deleted, ...remaining } = state.bibleRecordingSessions;
          return { bibleRecordingSessions: remaining };
        });
      },

      // Segment management
      addAudioSegment: (questId, segmentData) => {
        set((state) => {
          const session = state.bibleRecordingSessions[questId];
          if (!session) return state;

          const newSegment: AudioSegment = {
            ...segmentData,
            id: `segment-${Date.now()}-${Math.random()}`,
            questId,
            createdAt: Date.now(),
            order: session.segments.length
          };

          return {
            bibleRecordingSessions: {
              ...state.bibleRecordingSessions,
              [questId]: {
                ...session,
                segments: [...session.segments, newSegment],
                lastModified: Date.now()
              }
            }
          };
        });
      },

      updateAudioSegment: (questId, segmentId, updates) => {
        set((state) => {
          const session = state.bibleRecordingSessions[questId];
          if (!session) return state;

          const updatedSegments = session.segments.map((segment) =>
            segment.id === segmentId ? { ...segment, ...updates } : segment
          );

          return {
            bibleRecordingSessions: {
              ...state.bibleRecordingSessions,
              [questId]: {
                ...session,
                segments: updatedSegments,
                lastModified: Date.now()
              }
            }
          };
        });
      },

      deleteAudioSegment: (questId, segmentId) => {
        set((state) => {
          const session = state.bibleRecordingSessions[questId];
          if (!session) return state;

          const filteredSegments = session.segments.filter(
            (segment) => segment.id !== segmentId
          );

          return {
            bibleRecordingSessions: {
              ...state.bibleRecordingSessions,
              [questId]: {
                ...session,
                segments: filteredSegments,
                lastModified: Date.now()
              }
            }
          };
        });
      },

      reorderAudioSegments: (questId, fromIndex, toIndex) => {
        set((state) => {
          const session = state.bibleRecordingSessions[questId];
          if (!session) return state;

          const reorderedSegments = [...session.segments];
          const [movedSegment] = reorderedSegments.splice(fromIndex, 1);
          if (!movedSegment) return state;
          reorderedSegments.splice(toIndex, 0, movedSegment);

          // Update order property
          reorderedSegments.forEach((segment, index) => {
            segment.order = index;
          });

          return {
            bibleRecordingSessions: {
              ...state.bibleRecordingSessions,
              [questId]: {
                ...session,
                segments: reorderedSegments,
                lastModified: Date.now()
              }
            }
          };
        });
      },

      // Marker management
      addAssetMarker: (questId, markerData) => {
        set((state) => {
          const session = state.bibleRecordingSessions[questId];
          if (!session) return state;

          const newMarker: AssetMarker = {
            ...markerData,
            id: `marker-${Date.now()}-${Math.random()}`,
            questId,
            createdAt: Date.now(),
            order: session.markers.length
          };

          return {
            bibleRecordingSessions: {
              ...state.bibleRecordingSessions,
              [questId]: {
                ...session,
                markers: [...session.markers, newMarker],
                lastModified: Date.now()
              }
            }
          };
        });
      },

      updateAssetMarker: (questId, markerId, updates) => {
        set((state) => {
          const session = state.bibleRecordingSessions[questId];
          if (!session) return state;

          const updatedMarkers = session.markers.map((marker) =>
            marker.id === markerId ? { ...marker, ...updates } : marker
          );

          return {
            bibleRecordingSessions: {
              ...state.bibleRecordingSessions,
              [questId]: {
                ...session,
                markers: updatedMarkers,
                lastModified: Date.now()
              }
            }
          };
        });
      },

      deleteAssetMarker: (questId, markerId) => {
        set((state) => {
          const session = state.bibleRecordingSessions[questId];
          if (!session) return state;

          const filteredMarkers = session.markers.filter(
            (marker) => marker.id !== markerId
          );

          return {
            bibleRecordingSessions: {
              ...state.bibleRecordingSessions,
              [questId]: {
                ...session,
                markers: filteredMarkers,
                lastModified: Date.now()
              }
            }
          };
        });
      },

      reorderAssetMarkers: (questId, fromIndex, toIndex) => {
        set((state) => {
          const session = state.bibleRecordingSessions[questId];
          if (!session) return state;

          const reorderedMarkers = [...session.markers];
          const [movedMarker] = reorderedMarkers.splice(fromIndex, 1);
          if (!movedMarker) return state;
          reorderedMarkers.splice(toIndex, 0, movedMarker);

          // Update order property
          reorderedMarkers.forEach((marker, index) => {
            marker.order = index;
          });

          return {
            bibleRecordingSessions: {
              ...state.bibleRecordingSessions,
              [questId]: {
                ...session,
                markers: reorderedMarkers,
                lastModified: Date.now()
              }
            }
          };
        });
      },

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
