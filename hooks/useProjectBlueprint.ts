/**
 * Hook for loading a project's primary blueprint and providing
 * read-only access to its structure.
 */

import type { BlueprintStructure } from '@/constants/blueprintTypes';
import { system } from '@/db/powersync/system';
import {
  buildBlueprintIndex,
  parseBlueprintStructure,
  type BlueprintIndex
} from '@/utils/blueprintUtils';
import { resolveTable } from '@/utils/dbUtils';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';

interface ProjectBlueprintData {
  linkId: string;
  blueprintId: string;
  structure: BlueprintStructure;
  index: BlueprintIndex;
}

export function useProjectBlueprint(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-blueprint', projectId],
    queryFn: async (): Promise<ProjectBlueprintData | null> => {
      if (!projectId) return null;

      const pblTable = resolveTable('project_blueprint_link');
      const bpTable = resolveTable('template_blueprint');

      // Find the primary blueprint link for this project
      const links = await system.db
        .select({
          linkId: pblTable.id,
          blueprintId: pblTable.blueprint_id,
          structure: bpTable.structure
        })
        .from(pblTable)
        .innerJoin(bpTable, eq(pblTable.blueprint_id, bpTable.id))
        .where(eq(pblTable.project_id, projectId))
        .limit(1);

      if (links.length === 0) return null;

      const link = links[0];
      const structure = parseBlueprintStructure(link.structure);
      if (!structure) return null;

      return {
        linkId: link.linkId as string,
        blueprintId: link.blueprintId as string,
        structure,
        index: buildBlueprintIndex(structure)
      };
    },
    enabled: !!projectId
  });
}
