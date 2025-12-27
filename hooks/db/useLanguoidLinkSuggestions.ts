/**
 * Hooks for managing languoid link suggestions.
 * These help users link their custom-created languoids to existing ones.
 */

import { useAuth } from '@/contexts/AuthContext';
import { languoid, languoid_link_suggestion } from '@/db/drizzleSchema';
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

export interface LanguoidLinkSuggestionWithDetails
  extends LanguoidLinkSuggestion {
  languoid_name: string | null;
  suggested_languoid_name: string | null;
  suggested_languoid_level: string | null;
  suggested_languoid_ui_ready: boolean | null;
  suggested_iso_code: string | null;
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
        .orderBy(
          languoid_link_suggestion.languoid_id,
          languoid_link_suggestion.match_rank
        )
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
        .order('match_rank')
        .overrideTypes<LanguoidLinkSuggestion[]>();

      if (error) throw error;
      return data;
    }
  });

  // Get unique languoid IDs from suggestions
  const languoidIds = useMemo(() => {
    const ids = new Set<string>();
    for (const suggestion of rawSuggestions) {
      ids.add(suggestion.languoid_id);
      ids.add(suggestion.suggested_languoid_id);
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

  // Combine suggestions with languoid details
  const suggestions = useMemo<LanguoidLinkSuggestionWithDetails[]>(() => {
    return rawSuggestions.map((suggestion) => {
      const userLang = languoidMap.get(suggestion.languoid_id);
      const suggestedLang = languoidMap.get(suggestion.suggested_languoid_id);

      return {
        ...suggestion,
        languoid_name: userLang?.name ?? null,
        suggested_languoid_name: suggestedLang?.name ?? null,
        suggested_languoid_level: suggestedLang?.level ?? null,
        suggested_languoid_ui_ready: suggestedLang?.ui_ready ?? null,
        // ISO code from matched_value when matched_on is 'iso_code'
        suggested_iso_code:
          suggestion.matched_on === 'iso_code' ? suggestion.matched_value : null
      };
    });
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
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabaseConnector.client.rpc(
        'accept_languoid_link_suggestion',
        { p_suggestion_id: suggestionId }
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
    }
  });
}
