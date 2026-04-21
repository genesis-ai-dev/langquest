/**
 * Generalized hook for creating or finding quests from blueprint nodes.
 * Replaces useBibleBookCreation, useBibleChapterCreation, useFiaBookCreation,
 * and useFiaPericopeCreation with a single blueprint-driven hook.
 */

import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { resolveTable } from '@/utils/dbUtils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq, sql } from 'drizzle-orm';
import uuid from 'react-native-uuid';

interface FindOrCreateQuestParams {
  projectId: string;
  blueprintLinkId: string;
  blueprintNodeId: string;
  name: string;
  parentQuestId?: string | null;
}

interface QuestResult {
  id: string;
  name: string;
  project_id: string;
  blueprint_link_id: string | null;
  blueprint_node_id: string | null;
}

export function useQuestCreationFromBlueprint() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { mutateAsync: findOrCreateQuest, isPending } = useMutation({
    mutationFn: async (
      params: FindOrCreateQuestParams
    ): Promise<QuestResult> => {
      const {
        projectId,
        blueprintLinkId,
        blueprintNodeId,
        name,
        parentQuestId
      } = params;

      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      return await system.db.transaction(async (tx) => {
        const questTable = resolveTable('quest', { localOverride: true });

        // Look for existing quest by blueprint_node_id
        const existing = await tx
          .select({
            id: questTable.id,
            name: questTable.name,
            project_id: questTable.project_id,
            blueprint_link_id: questTable.blueprint_link_id,
            blueprint_node_id: questTable.blueprint_node_id
          })
          .from(questTable)
          .where(
            and(
              eq(questTable.project_id, projectId),
              eq(questTable.blueprint_link_id, blueprintLinkId),
              eq(questTable.blueprint_node_id, blueprintNodeId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          return existing[0] as QuestResult;
        }

        // Create new quest linked to blueprint node
        const newId = String(uuid.v4());
        const [created] = await tx
          .insert(questTable)
          .values({
            id: newId,
            name,
            project_id: projectId,
            parent_id: parentQuestId ?? null,
            creator_id: currentUser.id,
            blueprint_link_id: blueprintLinkId,
            blueprint_node_id: blueprintNodeId,
            download_profiles: [currentUser.id]
          })
          .returning();

        if (!created) {
          throw new Error('Failed to create quest');
        }

        return {
          id: created.id,
          name: created.name as string,
          project_id: created.project_id as string,
          blueprint_link_id: created.blueprint_link_id as string | null,
          blueprint_node_id: created.blueprint_node_id as string | null
        };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quests'] });
    }
  });

  return { findOrCreateQuest, isPending };
}
