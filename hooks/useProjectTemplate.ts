/**
 * Hook for loading a project's primary template and providing
 * read-only access to its structure.
 */

import type { TemplateStructure } from '@/constants/templateTypes';
import { system } from '@/db/powersync/system';
import {
  buildTemplateIndex,
  parseTemplateStructure,
  type TemplateIndex
} from '@/utils/templateUtils';
import { resolveTable } from '@/utils/dbUtils';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';

interface ProjectTemplateData {
  linkId: string;
  templateId: string;
  structure: TemplateStructure;
  index: TemplateIndex;
}

export function useProjectTemplate(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-template', projectId],
    queryFn: async (): Promise<ProjectTemplateData | null> => {
      if (!projectId) return null;

      const pblTable = resolveTable('project_template_link');
      const bpTable = resolveTable('template');

      const links = await system.db
        .select({
          linkId: pblTable.id,
          templateId: pblTable.template_id,
          structure: bpTable.structure
        })
        .from(pblTable)
        .innerJoin(bpTable, eq(pblTable.template_id, bpTable.id))
        .where(eq(pblTable.project_id, projectId))
        .limit(1);

      if (links.length === 0) return null;

      const link = links[0];
      const structure = parseTemplateStructure(link.structure);
      if (!structure) return null;

      return {
        linkId: link.linkId as string,
        templateId: link.templateId as string,
        structure,
        index: buildTemplateIndex(structure)
      };
    },
    enabled: !!projectId
  });
}
