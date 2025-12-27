/**
 * Hooks for managing languoid link suggestions.
 * These help users link their custom-created languoids to existing ones.
 */

import { useAuth } from '@/contexts/AuthContext';
import { languoid, languoid_link_suggestion } from '@/db/drizzleSchema';
import { languoid_link_suggestion_synced } from '@/db/drizzleSchemaSynced';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq, inArray } from 'drizzle-orm';
import { useMemo } from 'react';

export type LanguoidLinkSuggestion = InferSelectModel<
  typeof languoid_link_suggestion
>;

interface LanguoidDetail {
  id: string;
  name: string | null;
  level: string | null;
  ui_ready: boolean | null;
}

export interface SuggestionItem {
  suggested_languoid_id: string;
  match_rank: number;
  matched_on: string | null;
  matched_value: string | null;
}

// Flattened suggestion item with all details for display
export interface LanguoidLinkSuggestionWithDetails {
  id: string; // Row ID
  languoid_id: string;
  profile_id: string;
  suggested_languoid_id: string;
  match_rank: number;
  matched_on: string | null;
  matched_value: string | null;
  suggested_languoid_name: string | null;
  suggested_languoid_level: string | null;
  suggested_languoid_ui_ready: boolean | null;
  suggested_iso_code: string | null;
  languoid_name: string | null;
  status: string;
  active: boolean;
  created_at: string;
  last_updated: string;
}

/**
 * Fetches pending languoid link suggestions for the current user.
 * These are suggestions for linking user-created languoids to existing ones.
 */
export function useLanguoidLinkSuggestions() {
  const { currentUser } = useAuth();
  const { db, supabaseConnector } = system;

  const userId = currentUser?.id;

  // Fetch raw suggestions
  const {
    data: rawSuggestions = [],
    isLoading: isSuggestionsLoading,
    ...rest
  } = useHybridData<LanguoidLinkSuggestion>({
    dataType: 'languoid-link-suggestions',
    queryKeyParams: [userId],
    enabled: !!userId,

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      db
        .select()
        .from(languoid_link_suggestion)
        .where(
          and(
            eq(languoid_link_suggestion.profile_id, userId!),
            eq(languoid_link_suggestion.status, 'pending'),
            eq(languoid_link_suggestion.active, true)
          )
        )
        .orderBy(languoid_link_suggestion.languoid_id)
    ),

    // Cloud query
    cloudQueryFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('languoid_link_suggestion')
        .select('*')
        .eq('profile_id', userId!)
        .eq('status', 'pending')
        .eq('active', true)
        .order('languoid_id')
        .overrideTypes<LanguoidLinkSuggestion[]>();

      if (error) throw error;
      return data;
    }
  });

  // Get unique languoid IDs from suggestions
  const languoidIds = useMemo(() => {
    const ids = new Set<string>();
    for (const suggestionRow of rawSuggestions) {
      ids.add(suggestionRow.languoid_id);
      // Extract suggested_languoid_ids from the JSONB array
      if (
        suggestionRow.suggestions &&
        Array.isArray(suggestionRow.suggestions)
      ) {
        for (const item of suggestionRow.suggestions) {
          if (item.suggested_languoid_id) {
            ids.add(item.suggested_languoid_id);
          }
        }
      }
    }
    return Array.from(ids);
  }, [rawSuggestions]);

  // Fetch languoid details
  const { data: languoidDetails = [] } = useHybridData<LanguoidDetail>({
    dataType: 'languoid-link-suggestion-details',
    queryKeyParams: [languoidIds.join(',')],
    enabled: languoidIds.length > 0,

    offlineQuery: toCompilableQuery(
      db
        .select({
          id: languoid.id,
          name: languoid.name,
          level: languoid.level,
          ui_ready: languoid.ui_ready
        })
        .from(languoid)
        .where(inArray(languoid.id, languoidIds))
    ),

    cloudQueryFn: async () => {
      if (languoidIds.length === 0) return [];

      const { data, error } = await supabaseConnector.client
        .from('languoid')
        .select('id, name, level, ui_ready')
        .in('id', languoidIds)
        .overrideTypes<LanguoidDetail[]>();

      if (error) throw error;
      return data;
    },

    enableOfflineQuery: languoidIds.length > 0
  });

  // Create lookup map for languoid details
  const languoidMap = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string | null;
        level: string | null;
        ui_ready: boolean | null;
      }
    >();
    for (const lang of languoidDetails) {
      map.set(lang.id, {
        name: lang.name,
        level: lang.level,
        ui_ready: lang.ui_ready
      });
    }
    return map;
  }, [languoidDetails]);

  // Flatten suggestions - expand each suggestion row into individual suggestion items
  const suggestions = useMemo<LanguoidLinkSuggestionWithDetails[]>(() => {
    const flattened: LanguoidLinkSuggestionWithDetails[] = [];

    for (const suggestionRow of rawSuggestions) {
      const userLang = languoidMap.get(suggestionRow.languoid_id);
      const suggestionItems: SuggestionItem[] = Array.isArray(
        suggestionRow.suggestions
      )
        ? suggestionRow.suggestions
        : [];

      // Expand each suggestion item with languoid details
      for (const item of suggestionItems) {
        const suggestedLang = languoidMap.get(item.suggested_languoid_id);
        flattened.push({
          id: suggestionRow.id, // Row ID
          languoid_id: suggestionRow.languoid_id,
          profile_id: suggestionRow.profile_id,
          suggested_languoid_id: item.suggested_languoid_id,
          match_rank: item.match_rank,
          matched_on: item.matched_on,
          matched_value: item.matched_value,
          suggested_languoid_name: suggestedLang?.name ?? null,
          suggested_languoid_level: suggestedLang?.level ?? null,
          suggested_languoid_ui_ready: suggestedLang?.ui_ready ?? null,
          suggested_iso_code:
            item.matched_on === 'iso_code' ? item.matched_value : null,
          languoid_name: userLang?.name ?? null,
          status: suggestionRow.status,
          active: suggestionRow.active,
          created_at: suggestionRow.created_at,
          last_updated: suggestionRow.last_updated
        });
      }
    }

    return flattened;
  }, [rawSuggestions, languoidMap]);

  // Group suggestions by user languoid
  const groupedSuggestions = useMemo(() => {
    const groups = new Map<string, LanguoidLinkSuggestionWithDetails[]>();

    for (const suggestion of suggestions) {
      const key = suggestion.languoid_id;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(suggestion);
    }

    return Array.from(groups.entries()).map(([userLanguoidId, items]) => ({
      userLanguoidId,
      languoidName: items[0]?.languoid_name ?? 'Unknown',
      suggestions: items
    }));
  }, [suggestions]);

  return {
    suggestions,
    groupedSuggestions,
    suggestionsCount: rawSuggestions.length,
    uniqueLanguoidCount: groupedSuggestions.length,
    isLoading: isSuggestionsLoading,
    ...rest
  };
}

/**
 * Mutation hook to accept a languoid link suggestion.
 * This will update all references from the user languoid to the suggested languoid.
 */
export function useAcceptLanguoidLinkSuggestion() {
  const queryClient = useQueryClient();
  const { supabaseConnector } = system;

  return useMutation({
    mutationFn: async ({
      suggestionId,
      suggestedLanguoidId
    }: {
      suggestionId: string;
      suggestedLanguoidId: string;
    }) => {
      const { error } = await supabaseConnector.client.rpc(
        'accept_languoid_link_suggestion',
        {
          p_suggestion_id: suggestionId,
          p_suggested_languoid_id: suggestedLanguoidId
        }
      );

      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      // Invalidate related queries
      await queryClient.invalidateQueries({
        queryKey: ['languoid-link-suggestions']
      });
      await queryClient.invalidateQueries({ queryKey: ['languoids'] });
      await queryClient.invalidateQueries({ queryKey: ['my-projects'] });
      await queryClient.invalidateQueries({
        queryKey: ['project-language-link']
      });
      // Invalidate notification count queries used in AppHeader
      await queryClient.invalidateQueries({
        queryKey: ['languoid-suggestions-count']
      });
      await queryClient.invalidateQueries({
        queryKey: ['invite-notifications-count']
      });
      await queryClient.invalidateQueries({
        queryKey: ['request-notifications-count']
      });
    }
  });
}

/**
 * Mutation hook to reject a languoid link suggestion.
 */
export function useRejectLanguoidLinkSuggestion() {
  const queryClient = useQueryClient();
  const { supabaseConnector } = system;

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabaseConnector.client.rpc(
        'reject_languoid_link_suggestion',
        { p_suggestion_id: suggestionId }
      );

      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['languoid-link-suggestions']
      });
      // Invalidate notification count queries used in AppHeader
      await queryClient.invalidateQueries({
        queryKey: ['languoid-suggestions-count']
      });
    }
  });
}

/**
 * Mutation hook to dismiss all suggestions for a languoid (keep custom languoid).
 */
export function useKeepCustomLanguoid() {
  const queryClient = useQueryClient();
  const { supabaseConnector } = system;

  return useMutation({
    mutationFn: async (userLanguoidId: string) => {
      const { error } = await supabaseConnector.client.rpc(
        'keep_custom_languoid',
        { p_languoid_id: userLanguoidId }
      );

      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['languoid-link-suggestions']
      });
      // Invalidate notification count queries used in AppHeader
      await queryClient.invalidateQueries({
        queryKey: ['languoid-suggestions-count']
      });
    }
  });
}

/**
 * Hook to update a suggestion status locally (for offline support).
 * Used when updating via synced table directly.
 */
export function useUpdateSuggestionStatus() {
  const queryClient = useQueryClient();
  const { db } = system;

  return useMutation({
    mutationFn: async ({
      suggestionId,
      status
    }: {
      suggestionId: string;
      status: 'accepted' | 'declined' | 'withdrawn';
    }) => {
      await db
        .update(languoid_link_suggestion_synced)
        .set({
          status,
          last_updated: new Date().toISOString()
        })
        .where(eq(languoid_link_suggestion_synced.id, suggestionId));

      return { suggestionId, status };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['languoid-link-suggestions']
      });
    }
  });
}
