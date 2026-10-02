import { useAuth } from '@/contexts/AuthContext';
import type {
  AssetResult,
  QuestResult,
  ReviewAssetRow,
  ReviewQuestScope,
  ReviewRow
} from '@/database_services/reviewService';
import {
  createDraftReview,
  getDraftReviewForQuest,
  getReview,
  getReviewAssets,
  getReviewAudio,
  getReviewQuestScope,
  publishReview,
  reopenReviewDraft,
  submitReview,
  updateReviewAudio,
  updateReviewConclusion,
  updateReviewQuestResult,
  upsertReviewAsset
} from '@/database_services/reviewService';
import type { AssetContent } from '@/hooks/db/useAssets';
import { useAssetsContent, useLocalAssetsByQuest } from '@/hooks/db/useAssets';
import { useQuestById } from '@/hooks/db/useQuests';
import { createQuestVerseFormatter } from '@/utils/verseLabelUtils';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';
import { createStore,  useStore } from 'zustand';
import type {StoreApi} from 'zustand';

export interface ReviewAssetDraft {
  asset_result: AssetResult;
  comment: string;
  audio: string[];
}

export const EMPTY_REVIEW_ASSET: ReviewAssetDraft = {
  asset_result: 'not_reviewed',
  comment: '',
  audio: []
};

export interface AssetReviewContent {
  texts: string[];
  audio: string[];
}

export const EMPTY_ASSET_CONTENT: AssetReviewContent = { texts: [], audio: [] };

interface ReviewDraftConfig {
  projectId: string;
  questId: string;
  profileId: string;
  origin: string;
  questScope: ReviewQuestScope;
}

interface ReviewDraftState {
  isHydrated: boolean;
  reviewId: string | null;
  isSubmitted: boolean;
  questResult: QuestResult | null;
  conclusion: string;
  conclusionAudio: string[];
  assets: Record<string, ReviewAssetDraft>;
  recordingAssetId: string | null;
  setRecordingAssetId: (assetId: string | null) => void;
  setConclusion: (value: string) => Promise<void>;
  setConclusionAudio: (audio: string[]) => Promise<void>;
  hydrate: (
    config: ReviewDraftConfig,
    review: ReviewRow | null,
    reviewAssets: ReviewAssetRow[]
  ) => void;
  setQuestResult: (value: QuestResult | null) => Promise<void>;
  patchAsset: (
    assetId: string,
    patch: Partial<ReviewAssetDraft>
  ) => Promise<void>;
  submit: () => Promise<void>;
}

export type ReviewDraftStore = StoreApi<ReviewDraftState>;

// Drafts live in a store so each list item subscribes only to its own asset;
// editing one asset does not re-render the others.
function createReviewDraftStore(): ReviewDraftStore {
  let config: ReviewDraftConfig | null = null;
  let reviewId: string | null = null;
  let pendingCreate: Promise<string> | null = null;

  // The review row is only created on the first edit, so opening the screen
  // without touching anything leaves no empty drafts behind.
  const ensureReviewId = async () => {
    if (reviewId) return reviewId;
    if (!config) throw new Error('Review draft is not hydrated');

    pendingCreate ??= createDraftReview(config);
    reviewId = await pendingCreate;
    return reviewId;
  };

  return createStore<ReviewDraftState>()((set) => ({
    isHydrated: false,
    reviewId: null,
    isSubmitted: false,
    questResult: null,
    conclusion: '',
    conclusionAudio: [],
    assets: {},
    recordingAssetId: null,

    setRecordingAssetId: (assetId) => set({ recordingAssetId: assetId }),

    setConclusion: async (value) => {
      set({ conclusion: value });
      try {
        await updateReviewConclusion(await ensureReviewId(), value || null);
      } catch (error) {
        console.error('[ReviewDraft] Failed to save conclusion:', error);
      }
    },

    setConclusionAudio: async (audio) => {
      set({ conclusionAudio: audio });
      try {
        await updateReviewAudio(await ensureReviewId(), audio);
      } catch (error) {
        console.error('[ReviewDraft] Failed to save conclusion audio:', error);
      }
    },

    hydrate: (nextConfig, review, reviewAssets) => {
      config = nextConfig;
      reviewId = review?.id ?? null;
      set({
        isHydrated: true,
        reviewId,
        isSubmitted: review?.status === 'submitted',
        questResult: (review?.quest_result as QuestResult | null) ?? null,
        conclusion: review?.conclusion ?? '',
        conclusionAudio: review ? getReviewAudio(review) : [],
        assets: Object.fromEntries(
          reviewAssets.map((row) => [
            row.asset_id,
            {
              asset_result:
                (row.asset_result as AssetResult | null) ?? 'not_reviewed',
              comment: row.comment ?? '',
              audio: row.audio ?? []
            }
          ])
        )
      });
    },

    setQuestResult: async (value) => {
      set({ questResult: value });
      try {
        await updateReviewQuestResult(await ensureReviewId(), value);
      } catch (error) {
        console.error('[ReviewDraft] Failed to save quest result:', error);
      }
    },

    patchAsset: async (assetId, patch) => {
      set((state) => ({
        assets: {
          ...state.assets,
          [assetId]: {
            ...EMPTY_REVIEW_ASSET,
            ...state.assets[assetId],
            ...patch
          }
        }
      }));
      try {
        await upsertReviewAsset(await ensureReviewId(), assetId, patch);
      } catch (error) {
        console.error('[ReviewDraft] Failed to save asset review:', error);
      }
    },

    submit: async () => {
      if (!config) throw new Error('Review draft is not hydrated');
      const id = await ensureReviewId();
      set({ reviewId: id });
      await submitReview(id, config.questScope);
      try {
        await publishReview(id);
      } catch (error) {
        await reopenReviewDraft(id);
        throw error;
      }
      set({ isSubmitted: true });
    }
  }));
}

export const ReviewDraftContext = createContext<ReviewDraftStore | null>(null);

export function useReviewDraftStore() {
  const store = useContext(ReviewDraftContext);
  if (!store) {
    throw new Error('useReviewDraft must be used inside ReviewDraftContext');
  }
  return store;
}

export function useReviewDraft<T>(selector: (state: ReviewDraftState) => T) {
  return useStore(useReviewDraftStore(), selector);
}

// Merged views return a row from both the local and synced tables once
// content is published; keep one per id, preferring the synced copy.
function dedupePreferSynced<T extends { id: string; source?: string | null }>(
  rows: T[]
): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    const existing = byId.get(row.id);
    if (!existing || (row.source === 'synced' && existing.source !== 'synced')) {
      byId.set(row.id, row);
    }
  }
  return Array.from(byId.values());
}

function groupContentByAsset(contents: AssetContent[]) {
  const byAsset = new Map<string, AssetReviewContent>();
  const sorted = [...contents].sort((a, b) => a.order_index - b.order_index);
  for (const content of sorted) {
    const entry = byAsset.get(content.asset_id) ?? { texts: [], audio: [] };
    if (content.text?.trim()) entry.texts.push(content.text);
    if (content.audio?.length) entry.audio.push(...content.audio);
    byAsset.set(content.asset_id, entry);
  }
  return byAsset;
}

export function useReviewEditor({
  projectId,
  questId,
  reviewId,
  origin
}: {
  projectId: string;
  questId: string;
  reviewId?: string;
  origin: string;
}) {
  const { currentUser } = useAuth();
  const profileId = currentUser?.id;

  const [store] = useState(createReviewDraftStore);
  const isHydrated = useStore(store, (state) => state.isHydrated);

  const { quest, isQuestLoading } = useQuestById(questId);
  const formatVerse = createQuestVerseFormatter(quest?.metadata);

  const assetsQuery = useLocalAssetsByQuest(questId, '', false);
  const assets = dedupePreferSynced(
    assetsQuery.data.pages.flatMap((page) => page.data)
  );
  const { assetsContent } = useAssetsContent(assets.map((item) => item.id));
  const contentByAsset = groupContentByAsset(
    dedupePreferSynced(assetsContent)
  );

  const draftQuery = useQuery({
    queryKey: ['review-draft', reviewId ?? questId, profileId],
    queryFn: async () => {
      const review = reviewId
        ? await getReview(reviewId)
        : await getDraftReviewForQuest(questId, profileId!);
      const reviewAssets = review ? await getReviewAssets(review.id) : [];
      return { review, reviewAssets };
    },
    enabled: !!profileId,
    gcTime: 0
  });

  useEffect(() => {
    if (isHydrated || !draftQuery.data || !profileId || isQuestLoading) return;
    store.getState().hydrate(
      {
        projectId,
        questId,
        profileId,
        origin,
        questScope: getReviewQuestScope(quest?.metadata)
      },
      draftQuery.data.review,
      draftQuery.data.reviewAssets
    );
  }, [
    draftQuery.data,
    isHydrated,
    isQuestLoading,
    quest?.metadata,
    store,
    projectId,
    questId,
    profileId,
    origin
  ]);

  return {
    store,
    assets,
    contentByAsset,
    formatVerse,
    isLoading: assetsQuery.isLoading || !isHydrated
  };
}
