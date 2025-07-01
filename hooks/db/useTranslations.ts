import { getCurrentUser, useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/contexts/SystemContext';
import type { project, quest } from '@/db/drizzleSchema';
import {
  blocked_content,
  blocked_users,
  language,
  quest_asset_link,
  translation,
  vote
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQueryClient } from '@tanstack/react-query';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq, inArray, isNotNull, notInArray } from 'drizzle-orm';
import { useEffect } from 'react';
import {
  convertToFetchConfig,
  createHybridQueryConfig,
  hybridFetch,
  useHybridQuery,
  useHybridRealtimeQuery
} from '../useHybridQuery';
import { useNetworkStatus } from '../useNetworkStatus';

export type Translation = InferSelectModel<typeof translation>;
export type Vote = InferSelectModel<typeof vote>;
export type Language = InferSelectModel<typeof language>;
export type QuestAssetLink = InferSelectModel<typeof quest_asset_link>;
export type Quest = InferSelectModel<typeof quest>;
export type Project = InferSelectModel<typeof project>;

/**
 * Returns { translations, isLoading, error }
 * Fetches translations by asset ID from Supabase (online) or local Drizzle DB (offline)
 * Filters out blocked users and content if current_user_id is provided
 */

function getTranslationsByAssetIdConfig(asset_id: string | string[]) {
  const currentUser = getCurrentUser();
  const assetIds = Array.isArray(asset_id) ? asset_id : [asset_id];
  return createHybridQueryConfig({
    queryKey: [
      'translations',
      'by-asset',
      asset_id,
      currentUser?.id || 'anonymous'
    ],
    onlineFn: async () => {
      if (!currentUser) {
        // No user logged in, return all translations
        const { data, error } = await system.supabaseConnector.client
          .from('translation')
          .select('*')
          .in('asset_id', assetIds)
          .overrideTypes<Translation[]>();
        if (error) throw error;
        return data;
      }

      // Get blocked users and content for filtering
      const [blockedUsersResult, blockedContentResult] = await Promise.all([
        system.supabaseConnector.client
          .from('blocked_users')
          .select('blocked_id')
          .eq('blocker_id', currentUser.id),
        system.supabaseConnector.client
          .from('blocked_content')
          .select('content_id')
          .eq('profile_id', currentUser.id)
          .eq('content_table', 'translations')
      ]);

      if (blockedUsersResult.error) throw blockedUsersResult.error;
      if (blockedContentResult.error) throw blockedContentResult.error;

      const blockedUserIds = blockedUsersResult.data.map(
        (item) => item.blocked_id as string
      );
      const blockedContentIds = blockedContentResult.data.map(
        (item) => item.content_id as string
      );

      // Build query with filters
      let query = system.supabaseConnector.client
        .from('translation')
        .select('*')
        .in('asset_id', assetIds);

      if (blockedUserIds.length > 0) {
        query = query.not('creator_id', 'in', `(${blockedUserIds.join(',')})`);
      }

      if (blockedContentIds.length > 0) {
        query = query.not('id', 'in', `(${blockedContentIds.join(',')})`);
      }

      const { data, error } = await query.overrideTypes<Translation[]>();
      if (error) throw error;
      return data;
    },
    offlineFn: async () => {
      if (!currentUser?.id) {
        // No user logged in, return all translations
        return await system.db.query.translation.findMany({
          where: inArray(translation.asset_id, assetIds)
        });
      }

      // Get blocked users and content for filtering
      const [blockedUsers, blockedContent] = await Promise.all([
        system.db.query.blocked_users.findMany({
          where: eq(blocked_users.blocker_id, currentUser.id),
          columns: {
            blocked_id: true
          }
        }),
        system.db.query.blocked_content.findMany({
          where: and(
            eq(blocked_content.profile_id, currentUser.id),
            eq(blocked_content.content_table, 'translations')
          ),
          columns: {
            content_id: true
          }
        })
      ]);

      const blockedUserIds = blockedUsers.map((item) => item.blocked_id);
      const blockedContentIds = blockedContent.map((item) => item.content_id);

      // Get all translations for this asset
      return await system.db.query.translation.findMany({
        where: and(
          inArray(translation.asset_id, assetIds),
          notInArray(translation.id, blockedContentIds),
          notInArray(translation.creator_id, blockedUserIds)
        )
      });
    },
    enabled: !!asset_id
  });
}

export function getTranslationsByAssetId(asset_id: string) {
  return hybridFetch(
    convertToFetchConfig(getTranslationsByAssetIdConfig(asset_id))
  );
}

export function getTranslationsByAssetIds(asset_ids: string[]) {
  return hybridFetch(
    convertToFetchConfig(getTranslationsByAssetIdConfig(asset_ids))
  );
}

export function useTranslationsByAssetId(asset_id: string) {
  const { db } = useSystem();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const invalidate = () =>
    void queryClient.invalidateQueries({
      queryKey: [
        'translations',
        'by-asset',
        asset_id,
        currentUser?.id || 'anonymous'
      ]
    });

  useEffect(() => {
    const abortController = new AbortController();

    db.watch(
      db.query.translation.findMany({
        where: eq(translation.asset_id, asset_id),
        columns: {}
      }),
      {
        onResult: invalidate
      }
    );

    db.watch(
      db
        .select({})
        .from(blocked_content)
        .innerJoin(translation, eq(blocked_content.content_id, translation.id))
        .where(
          and(
            eq(blocked_content.profile_id, currentUser?.id || ''),
            eq(blocked_content.content_table, 'translations'),
            eq(translation.asset_id, asset_id)
          )
        ),
      {
        onResult: invalidate
      }
    );

    db.watch(
      db
        .select({})
        .from(blocked_users)
        .innerJoin(
          translation,
          eq(blocked_users.blocked_id, translation.creator_id)
        )
        .where(eq(translation.asset_id, asset_id)),
      {
        onResult: invalidate
      }
    );

    return () => {
      abortController.abort();
    };
  }, [asset_id, currentUser?.id, db]);

  const {
    data: translations,
    isLoading: isTranslationsLoading,
    ...rest
  } = useHybridRealtimeQuery({
    ...getTranslationsByAssetIdConfig(asset_id),
    subscribeRealtime: (onChange) => {
      const channel = system.supabaseConnector.client
        .channel('public:translation')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'translation' },
          onChange
        );
      channel.subscribe();
      return () => system.supabaseConnector.client.removeChannel(channel);
    }
  });

  return { translations, isTranslationsLoading, ...rest };
}

/**
 * Returns { translation, isLoading, error }
 * Fetches a single translation by ID from Supabase (online) or local Drizzle DB (offline)
 * Filters out blocked users and content if current_user_id is provided
 */
export function useTranslationById(
  translation_id: string,
  current_user_id?: string
) {
  const { db, supabaseConnector } = useSystem();

  const {
    data: translationArray,
    isLoading: isTranslationLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['translation', translation_id, current_user_id || 'anonymous'],
    onlineFn: async () => {
      if (!current_user_id) {
        // No user logged in, return translation directly
        const { data, error } = await supabaseConnector.client
          .from('translation')
          .select('*')
          .eq('id', translation_id)
          .overrideTypes<Translation[]>();
        if (error) throw error;
        return data;
      }

      // Check if this translation is blocked
      const { data: blockedContent, error: blockedError } =
        await supabaseConnector.client
          .from('blocked_content')
          .select('content_id')
          .eq('profile_id', current_user_id)
          .eq('content_id', translation_id)
          .eq('content_table', 'translation');

      if (blockedError) throw blockedError;
      if (blockedContent.length > 0) {
        return []; // Translation is blocked
      }

      // Get the translation
      const { data: translationData, error: translationError } =
        await supabaseConnector.client
          .from('translation')
          .select('*')
          .eq('id', translation_id)
          .overrideTypes<Translation[]>();

      if (translationError) throw translationError;
      if (translationData.length === 0) {
        return [];
      }

      // Check if created by a blocked user
      const { data: blockedUser, error: blockedUserError } =
        await supabaseConnector.client
          .from('blocked_users')
          .select('blocked_id')
          .eq('blocker_id', current_user_id)
          .eq('blocked_id', translationData[0]?.creator_id || '');

      if (blockedUserError) throw blockedUserError;
      if (blockedUser.length > 0) {
        return []; // Creator is blocked
      }

      return translationData;
    },
    offlineQuery: toCompilableQuery(
      db.query.translation.findMany({
        where: eq(translation.id, translation_id)
      })
    ),
    enabled: !!translation_id
  });

  const translationData = translationArray?.[0] || null;

  return { translation: translationData, isTranslationLoading, ...rest };
}

/**
 * Returns { translationsWithVotes, isLoading, error }
 * Fetches translations with their votes by asset ID from Supabase (online) or local Drizzle DB (offline)
 * Filters out blocked users and content if current_user_id is provided
 */
export function useTranslationsWithVotesByAssetId(asset_id: string) {
  const { db, supabaseConnector } = useSystem();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();

  const invalidate = () =>
    void queryClient.invalidateQueries({
      queryKey: [
        'translations-with-votes',
        'by-asset',
        asset_id,
        currentUser?.id || 'anonymous'
      ]
    });

  useEffect(() => {
    if (isOnline) return;
    const abortController = new AbortController();

    db.watch(
      db.query.translation.findMany({
        where: eq(translation.asset_id, asset_id),
        columns: {}
      }),
      {
        onResult: invalidate
      }
    );

    db.watch(
      db
        .select({})
        .from(vote)
        .innerJoin(translation, eq(vote.translation_id, translation.id))
        .where(eq(translation.asset_id, asset_id)),
      {
        onResult: invalidate
      }
    );

    db.watch(
      db
        .select({})
        .from(blocked_content)
        .innerJoin(translation, eq(blocked_content.content_id, translation.id))
        .where(
          and(
            eq(blocked_content.profile_id, currentUser?.id || ''),
            eq(blocked_content.content_table, 'translations'),
            eq(translation.asset_id, asset_id)
          )
        ),
      {
        onResult: invalidate
      }
    );

    db.watch(
      db
        .select({})
        .from(blocked_users)
        .innerJoin(
          translation,
          eq(blocked_users.blocked_id, translation.creator_id)
        )
        .where(eq(translation.asset_id, asset_id)),
      {
        onResult: invalidate
      }
    );

    return () => {
      abortController.abort();
    };
  }, [asset_id, currentUser?.id, db]);

  const {
    data: translationsWithVotes,
    isLoading: isTranslationsWithVotesLoading,
    ...rest
  } = useHybridQuery({
    queryKey: [
      'translations-with-votes',
      'by-asset',
      asset_id,
      currentUser?.id || 'anonymous'
    ],
    onlineFn: async () => {
      if (!currentUser) {
        // No user logged in, return all translations with votes
        const { data, error } = await supabaseConnector.client
          .from('translation')
          .select(
            `
            *,
            votes:vote (*)
          `
          )
          .eq('asset_id', asset_id)
          .overrideTypes<(Translation & { votes: Vote[] })[]>();
        if (error) throw error;
        return data;
      }

      // Get blocked users and content for filtering
      const [blockedUsersResult, blockedContentResult] = await Promise.all([
        supabaseConnector.client
          .from('blocked_users')
          .select('blocked_id')
          .eq('blocker_id', currentUser.id),
        supabaseConnector.client
          .from('blocked_content')
          .select('content_id')
          .eq('profile_id', currentUser.id)
          .eq('content_table', 'translations')
      ]);

      if (blockedUsersResult.error) throw blockedUsersResult.error;
      if (blockedContentResult.error) throw blockedContentResult.error;

      const blockedUserIds = blockedUsersResult.data.map(
        (item) => item.blocked_id as string
      );
      const blockedContentIds = blockedContentResult.data.map(
        (item) => item.content_id as string
      );

      // Build query with filters
      let query = supabaseConnector.client
        .from('translation')
        .select(
          `
          *,
          votes:vote (*)
        `
        )
        .eq('asset_id', asset_id);

      if (blockedUserIds.length > 0) {
        query = query.not('creator_id', 'in', `(${blockedUserIds.join(',')})`);
      }

      if (blockedContentIds.length > 0) {
        query = query.not('id', 'in', `(${blockedContentIds.join(',')})`);
      }

      const { data, error } =
        await query.overrideTypes<(Translation & { votes: Vote[] })[]>();
      if (error) throw error;
      return data;
    },
    offlineFn: async () => {
      if (!currentUser?.id) {
        // No user logged in, return all translations with votes
        return await db.query.translation.findMany({
          where: eq(translation.asset_id, asset_id),
          with: {
            votes: true
          }
        });
      }

      // Get blocked users and content for filtering
      const [blockedUsers, blockedContent] = await Promise.all([
        db.query.blocked_users.findMany({
          where: eq(blocked_users.blocker_id, currentUser.id),
          columns: {
            blocked_id: true
          }
        }),
        db.query.blocked_content.findMany({
          where: and(
            eq(blocked_content.profile_id, currentUser.id),
            eq(blocked_content.content_table, 'translations')
          ),
          columns: {
            content_id: true
          }
        })
      ]);

      const blockedUserIds = blockedUsers.map((item) => item.blocked_id);
      const blockedContentIds = blockedContent.map((item) => item.content_id);

      // Get all translations for this asset with votes
      return await db.query.translation.findMany({
        where: and(
          eq(translation.asset_id, asset_id),
          notInArray(translation.id, blockedContentIds),
          notInArray(translation.creator_id, blockedUserIds)
        ),
        with: {
          votes: true
        }
      });
    },
    enabled: !!asset_id
  });

  return { translationsWithVotes, isTranslationsWithVotesLoading, ...rest };
}

/**
 * Returns { translationsWithVotesAndLanguage, isLoading, error }
 * Fetches translations with their votes and language information by asset ID from Supabase (online) or local Drizzle DB (offline)
 * Filters out blocked users and content if current_user_id is provided
 */
export function useTranslationsWithVotesAndLanguageByAssetId(asset_id: string) {
  const { db, supabaseConnector } = useSystem();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();

  const invalidate = () =>
    void queryClient.invalidateQueries({
      queryKey: [
        'translations-with-votes-and-language',
        'by-asset',
        asset_id,
        currentUser?.id || 'anonymous'
      ]
    });

  useEffect(() => {
    if (isOnline) return;

    const abortController = new AbortController();

    db.watch(
      db.query.translation.findMany({
        where: eq(translation.asset_id, asset_id),
        columns: {
          asset_id: true
        }
      }),
      {
        onResult: invalidate
      }
    );

    db.watch(
      db
        .select({
          id: translation.id
        })
        .from(vote)
        .innerJoin(translation, eq(vote.translation_id, translation.id))
        .where(eq(translation.asset_id, asset_id)),
      {
        onResult: invalidate
      }
    );

    db.watch(
      db
        .select({
          id: language.id
        })
        .from(language)
        .innerJoin(translation, eq(language.id, translation.target_language_id))
        .where(eq(translation.asset_id, asset_id)),
      {
        onResult: invalidate
      }
    );

    db.watch(
      db
        .select({
          id: blocked_content.profile_id,
          content_id: blocked_content.content_id
        })
        .from(blocked_content)
        .innerJoin(translation, eq(blocked_content.content_id, translation.id))
        .where(
          and(
            eq(blocked_content.profile_id, currentUser?.id || ''),
            eq(blocked_content.content_table, 'translations'),
            eq(translation.asset_id, asset_id)
          )
        ),
      {
        onResult: invalidate
      }
    );

    db.watch(
      db
        .select({
          id: blocked_users.blocked_id
        })
        .from(blocked_users)
        .innerJoin(
          translation,
          eq(blocked_users.blocked_id, translation.creator_id)
        )
        .where(eq(translation.asset_id, asset_id)),
      {
        onResult: invalidate
      }
    );

    return () => {
      abortController.abort();
    };
  }, [asset_id, currentUser?.id, db]);

  const {
    data: translationsWithVotesAndLanguage,
    isLoading: isTranslationsWithVotesAndLanguageLoading,
    ...rest
  } = useHybridQuery({
    queryKey: [
      'translations-with-votes-and-language',
      'by-asset',
      asset_id,
      currentUser?.id || 'anonymous'
    ],
    onlineFn: async () => {
      if (!currentUser) {
        // No user logged in, return all translations with votes and language
        const { data, error } = await supabaseConnector.client
          .from('translation')
          .select(
            `
            *,
            votes:vote (*),
            target_language:language (*)
          `
          )
          .eq('asset_id', asset_id)
          .overrideTypes<
            (Translation & { votes: Vote[]; target_language: Language })[]
          >();
        if (error) throw error;
        return data;
      }

      // Get blocked users and content for filtering
      const [blockedUsersResult, blockedContentResult] = await Promise.all([
        supabaseConnector.client
          .from('blocked_users')
          .select('blocked_id')
          .eq('blocker_id', currentUser.id),
        supabaseConnector.client
          .from('blocked_content')
          .select('content_id')
          .eq('profile_id', currentUser.id)
          .eq('content_table', 'translations')
      ]);

      if (blockedUsersResult.error) throw blockedUsersResult.error;
      if (blockedContentResult.error) throw blockedContentResult.error;

      const blockedUserIds = blockedUsersResult.data.map(
        (item) => item.blocked_id as string
      );
      const blockedContentIds = blockedContentResult.data.map(
        (item) => item.content_id as string
      );

      // Build query with filters
      let query = supabaseConnector.client
        .from('translation')
        .select(
          `
          *,
          votes:vote (*),
          target_language:language (*)
        `
        )
        .eq('asset_id', asset_id);

      if (blockedUserIds.length > 0) {
        query = query.not('creator_id', 'in', `(${blockedUserIds.join(',')})`);
      }

      if (blockedContentIds.length > 0) {
        query = query.not('id', 'in', `(${blockedContentIds.join(',')})`);
      }

      const { data, error } =
        await query.overrideTypes<
          (Translation & { votes: Vote[]; target_language: Language })[]
        >();
      if (error) throw error;
      return data;
    },
    offlineFn: async () => {
      if (!currentUser?.id) {
        // No user logged in, return all translations with votes and language
        return await db.query.translation.findMany({
          where: eq(translation.asset_id, asset_id),
          with: {
            votes: true,
            target_language: true
          }
        });
      }

      // Get blocked users and content for filtering
      const [blockedUsers, blockedContent] = await Promise.all([
        db.query.blocked_users.findMany({
          where: eq(blocked_users.blocker_id, currentUser.id),
          columns: {
            blocked_id: true
          }
        }),
        db.query.blocked_content.findMany({
          where: and(
            eq(blocked_content.profile_id, currentUser.id),
            eq(blocked_content.content_table, 'translations')
          ),
          columns: {
            content_id: true
          }
        })
      ]);

      const blockedUserIds = blockedUsers.map((item) => item.blocked_id);
      const blockedContentIds = blockedContent.map((item) => item.content_id);

      // Get all translations for this asset with votes and language
      return await db.query.translation.findMany({
        where: and(
          eq(translation.asset_id, asset_id),
          notInArray(translation.id, blockedContentIds),
          notInArray(translation.creator_id, blockedUserIds)
        ),
        with: {
          votes: true,
          target_language: true
        }
      });
    },
    enabled: !!asset_id
  });

  return {
    translationsWithVotesAndLanguage,
    isTranslationsWithVotesAndLanguageLoading,
    ...rest
  };
}

function getTranslationsWithAudioByAssetIdConfig(asset_id: string) {
  return createHybridQueryConfig({
    queryKey: ['translations-with-audio', 'by-asset', asset_id],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('translation')
        .select('*')
        .eq('asset_id', asset_id)
        .not('audio', 'is', null)
        .overrideTypes<Translation[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      system.db.query.translation.findMany({
        where: and(
          eq(translation.asset_id, asset_id),
          isNotNull(translation.audio)
        )
      })
    ),
    enabled: !!asset_id
  });
}

export function getTranslationsWithAudioByAssetId(asset_id: string) {
  return hybridFetch(
    convertToFetchConfig(getTranslationsWithAudioByAssetIdConfig(asset_id))
  );
}

export function useTranslationsWithAudioByAssetId(asset_id: string) {
  const {
    data: translationsWithAudio,
    isLoading: isTranslationsWithAudioLoading,
    ...rest
  } = useHybridQuery(getTranslationsWithAudioByAssetIdConfig(asset_id));

  return { translationsWithAudio, isTranslationsWithAudioLoading, ...rest };
}

function getTranslationsWithAudioByAssetIdsConfig(asset_ids: string[]) {
  return createHybridQueryConfig({
    queryKey: ['translations-with-audio', 'by-assets', asset_ids],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('translation')
        .select('*')
        .in('asset_id', asset_ids)
        .not('audio', 'is', null)
        .overrideTypes<Translation[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      system.db.query.translation.findMany({
        where: and(
          inArray(translation.asset_id, asset_ids),
          isNotNull(translation.audio)
        )
      })
    ),
    enabled: !!asset_ids.length
  });
}

export function getTranslationsWithAudioByAssetIds(asset_ids: string[]) {
  return hybridFetch(
    convertToFetchConfig(getTranslationsWithAudioByAssetIdsConfig(asset_ids))
  );
}

export function useTranslationsWithAudioByAssetIds(asset_ids: string[]) {
  const {
    data: translationsWithAudio,
    isLoading: isTranslationsWithAudioLoading,
    ...rest
  } = useHybridQuery(getTranslationsWithAudioByAssetIdsConfig(asset_ids));

  return { translationsWithAudio, isTranslationsWithAudioLoading, ...rest };
}

/**
 * Returns { projectInfo, isLoading, error }
 * Fetches project information for a translation by asset ID
 * Includes quest and project details
 */
export function useTranslationProjectInfo(asset_id: string | undefined) {
  const { db } = useSystem();

  const {
    data: projectInfoArray,
    isLoading: isProjectInfoLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['translation-project', asset_id],
    onlineFn: async () => {
      if (!asset_id) return [];

      const { data, error } = await system.supabaseConnector.client
        .from('quest_asset_link')
        .select(
          `
          *,
          quest:quest_id (
            *,
            project:project_id (*)
          )
        `
        )
        .eq('asset_id', asset_id)
        .limit(1)
        .overrideTypes<
          (QuestAssetLink & {
            quest: Quest & {
              project: Project;
            };
          })[]
        >();

      if (error) throw error;
      return data;
    },
    offlineFn: async () => {
      if (!asset_id) return [];

      const result = await db.query.quest_asset_link.findFirst({
        where: eq(quest_asset_link.asset_id, asset_id),
        with: {
          quest: {
            with: {
              project: true
            }
          }
        }
      });

      return result ? [result] : [];
    },
    enabled: !!asset_id
  });

  const projectInfo = Array.isArray(projectInfoArray)
    ? projectInfoArray[0]
    : projectInfoArray;

  return { projectInfo, isProjectInfoLoading, ...rest };
}
