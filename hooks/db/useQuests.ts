import { useSystem } from '@/contexts/SystemContext';
import { quest as questTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import {
  convertToFetchConfig,
  createHybridQueryConfig,
  hybridFetch,
  useHybridQuery
} from '../useHybridQuery';
import type { Tag } from './useTags';

export type Quest = InferSelectModel<typeof questTable>;

function getQuestsByProjectIdConfig(project_id: string) {
  return createHybridQueryConfig({
    queryKey: ['quests', 'by-project', project_id],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('project_id', project_id)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      system.db.query.quest.findMany({
        where: eq(questTable.project_id, project_id)
      })
    ),
    enabled: !!project_id
  });
}

export function getQuestsByProjectId(project_id: string) {
  return hybridFetch(
    convertToFetchConfig(getQuestsByProjectIdConfig(project_id))
  );
}

/**
 * Returns { quests, isLoading, error }
 * Fetches quests by project ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useQuestsByProjectId(project_id: string) {
  const {
    data: quests,
    isLoading: isQuestsLoading,
    ...rest
  } = useHybridQuery(getQuestsByProjectIdConfig(project_id));

  return { quests, isQuestsLoading, ...rest };
}

export function useQuestsWithTagsByProjectId(project_id: string) {
  const { db, supabaseConnector } = useSystem();

  const {
    data: quests,
    isLoading: isQuestsLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['quests', 'by-project', 'with-tags', project_id],
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('quest')
        .select(
          `
          *,
          tags:quest_tag_link (
            tag:tag_id (
              id,
              name,
              active,
              created_at,
              last_updated
            )
          )
        `
        )
        .eq('project_id', project_id)
        .overrideTypes<(Quest & { tags: { tag: Tag }[] })[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.quest.findMany({
        where: eq(questTable.project_id, project_id),
        with: {
          tags: {
            with: {
              tag: true
            }
          }
        }
      })
    ),
    enabled: !!project_id
  });

  return { quests, isQuestsLoading, ...rest };
}

/**
 * Returns { quest, isLoading, error }
 * Fetches a single quest by ID from Supabase (online) or local Drizzle DB (offline)
 */
export function useQuestById(quest_id: string) {
  const { db, supabaseConnector } = useSystem();

  const {
    data: questArray,
    isLoading: isQuestLoading,
    ...rest
  } = useHybridQuery({
    queryKey: ['quest', quest_id],
    onlineFn: async () => {
      const { data, error } = await supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('id', quest_id)
        .overrideTypes<Quest[]>();
      if (error) throw error;
      return data;
    },
    offlineQuery: toCompilableQuery(
      db.query.quest.findMany({
        where: eq(questTable.id, quest_id)
      })
    ),
    enabled: !!quest_id
  });

  const quest = questArray?.[0] || null;

  return { quest, isQuestLoading, ...rest };
}
