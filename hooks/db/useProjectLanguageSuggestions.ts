/**
 * Hooks for managing project language suggestions (Event 1).
 *
 * These suggestions are inserted server-side by the
 * `suggest_project_language_trigger` on `project_language_link` and surfaced
 * here to project owners through the notifications screen.
 */

import { useAuth } from '@/contexts/AuthContext';
import {
  languoid,
  profile_project_link,
  project,
  project_language_suggestion
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq, inArray } from 'drizzle-orm';
import { useMemo } from 'react';

export type ProjectLanguageSuggestion = InferSelectModel<
  typeof project_language_suggestion
>;

export interface ProjectLanguageSuggestionWithDetails extends ProjectLanguageSuggestion {
  project_name: string | null;
  current_languoid_name: string | null;
  suggested_languoid_name: string | null;
}

/**
 * Fetches pending project_language_suggestion rows for projects the current
 * user owns. Suggestions are joined with the project name and both languoid
 * names for display.
 */
export function useProjectLanguageSuggestions() {
  const { currentUser } = useAuth();
  const { db, supabaseConnector } = system;
  const userId = currentUser?.id;

  // Step 1: find project ids this user owns
  const { data: ownerProjectLinks = [] } = useHybridData<{
    project_id: string;
  }>({
    dataType: 'project-language-suggestion-owner-projects',
    queryKeyParams: [userId],
    enabled: !!userId,
    offlineQuery: toCompilableQuery(
      db
        .select({ project_id: profile_project_link.project_id })
        .from(profile_project_link)
        .where(
          and(
            eq(profile_project_link.profile_id, userId!),
            eq(profile_project_link.membership, 'owner'),
            eq(profile_project_link.active, true)
          )
        )
    ),
    cloudQueryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabaseConnector.client
        .from('profile_project_link')
        .select('project_id')
        .eq('profile_id', userId)
        .eq('membership', 'owner')
        .eq('active', true);
      if (error) throw error;
      return data as { project_id: string }[];
    }
  });

  const ownerProjectIds = useMemo(() => {
    return [...new Set(ownerProjectLinks.map((p) => p.project_id))].sort();
  }, [ownerProjectLinks]);

  // Step 2: fetch pending suggestions for those projects
  const {
    data: rawSuggestions = [],
    isLoading: isSuggestionsLoading,
    ...rest
  } = useHybridData<ProjectLanguageSuggestion>({
    dataType: 'project-language-suggestions',
    queryKeyParams: [ownerProjectIds.join(',')],
    enabled: !!userId && ownerProjectIds.length > 0,
    offlineQuery: toCompilableQuery(
      db
        .select()
        .from(project_language_suggestion)
        .where(
          and(
            inArray(project_language_suggestion.project_id, ownerProjectIds),
            eq(project_language_suggestion.status, 'pending'),
            eq(project_language_suggestion.active, true)
          )
        )
    ),
    cloudQueryFn: async () => {
      if (ownerProjectIds.length === 0) return [];
      const { data, error } = await supabaseConnector.client
        .from('project_language_suggestion')
        .select('*')
        .in('project_id', ownerProjectIds)
        .eq('status', 'pending')
        .eq('active', true)
        .overrideTypes<ProjectLanguageSuggestion[]>();
      if (error) throw error;
      return data;
    }
  });

  // Step 3: collect referenced project + languoid ids for detail joins
  const detailIds = useMemo(() => {
    const projects = new Set<string>();
    const languoids = new Set<string>();
    for (const s of rawSuggestions) {
      projects.add(s.project_id);
      languoids.add(s.current_languoid_id);
      languoids.add(s.suggested_languoid_id);
    }
    return {
      projectIds: Array.from(projects),
      languoidIds: Array.from(languoids)
    };
  }, [rawSuggestions]);

  // Project name lookup
  const { data: projectDetails = [] } = useHybridData<{
    id: string;
    name: string | null;
  }>({
    dataType: 'project-language-suggestion-project-details',
    queryKeyParams: [detailIds.projectIds.join(',')],
    enabled: detailIds.projectIds.length > 0,
    offlineQuery: toCompilableQuery(
      db
        .select({ id: project.id, name: project.name })
        .from(project)
        .where(inArray(project.id, detailIds.projectIds))
    ),
    cloudQueryFn: async () => {
      if (detailIds.projectIds.length === 0) return [];
      const { data, error } = await supabaseConnector.client
        .from('project')
        .select('id, name')
        .in('id', detailIds.projectIds);
      if (error) throw error;
      return data as { id: string; name: string | null }[];
    }
  });

  // Languoid name lookup (covers both current + suggested)
  const { data: languoidDetails = [] } = useHybridData<{
    id: string;
    name: string | null;
  }>({
    dataType: 'project-language-suggestion-languoid-details',
    queryKeyParams: [detailIds.languoidIds.join(',')],
    enabled: detailIds.languoidIds.length > 0,
    offlineQuery: toCompilableQuery(
      db
        .select({ id: languoid.id, name: languoid.name })
        .from(languoid)
        .where(inArray(languoid.id, detailIds.languoidIds))
    ),
    cloudQueryFn: async () => {
      if (detailIds.languoidIds.length === 0) return [];
      const { data, error } = await supabaseConnector.client
        .from('languoid')
        .select('id, name')
        .in('id', detailIds.languoidIds);
      if (error) throw error;
      return data as { id: string; name: string | null }[];
    }
  });

  // Stitch everything together
  const suggestions = useMemo<ProjectLanguageSuggestionWithDetails[]>(() => {
    const projectNameById = new Map(
      projectDetails.map((p) => [p.id, p.name] as const)
    );
    const languoidNameById = new Map(
      languoidDetails.map((l) => [l.id, l.name] as const)
    );
    return rawSuggestions.map((s) => ({
      ...s,
      project_name: projectNameById.get(s.project_id) ?? null,
      current_languoid_name:
        languoidNameById.get(s.current_languoid_id) ?? null,
      suggested_languoid_name:
        languoidNameById.get(s.suggested_languoid_id) ?? null
    }));
  }, [rawSuggestions, projectDetails, languoidDetails]);

  return {
    suggestions,
    suggestionsCount: suggestions.length,
    isLoading: isSuggestionsLoading,
    ...rest
  };
}

/**
 * Mutation hook to accept a project_language_suggestion.
 * Swaps the project's target language link to the suggested languoid.
 */
export function useAcceptProjectLanguageSuggestion() {
  const queryClient = useQueryClient();
  const { supabaseConnector } = system;

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabaseConnector.client.rpc(
        'accept_project_language_suggestion',
        { p_suggestion_id: suggestionId }
      );
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['project-language-suggestions']
      });
      await queryClient.invalidateQueries({
        queryKey: ['project-language-link']
      });
      await queryClient.invalidateQueries({ queryKey: ['my-projects'] });
    }
  });
}

/**
 * Mutation hook to dismiss a project_language_suggestion.
 * Marks the row as declined; no schema changes to the project itself.
 */
export function useDismissProjectLanguageSuggestion() {
  const queryClient = useQueryClient();
  const { supabaseConnector } = system;

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabaseConnector.client.rpc(
        'dismiss_project_language_suggestion',
        { p_suggestion_id: suggestionId }
      );
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['project-language-suggestions']
      });
    }
  });
}
