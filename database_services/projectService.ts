import { languoid, project, project_language_link } from '@/db/drizzleSchema';
import { and, eq } from 'drizzle-orm';
import { system } from '../db/powersync/system';

export type Project = typeof project.$inferSelect;
export type Languoid = typeof languoid.$inferSelect;

export interface ProjectWithRelatedLanguoid {
  project: Project;
  languoid: Languoid | null;
}

export class ProjectService {
  async getProjectWithRelatedLanguoid(
    projectId: string
  ): Promise<ProjectWithRelatedLanguoid | null> {
    const [projectRecord] = await system.db
      .select()
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);

    if (!projectRecord) {
      return null;
    }

    const [targetLanguageLink] = await system.db
      .select({ languoid_id: project_language_link.languoid_id })
      .from(project_language_link)
      .where(
        and(
          eq(project_language_link.project_id, projectId),
          eq(project_language_link.language_type, 'target')
        )
      )
      .limit(1);

    if (!targetLanguageLink?.languoid_id) {
      return {
        project: projectRecord,
        languoid: null
      };
    }

    const [languoidRecord] = await system.db
      .select()
      .from(languoid)
      .where(eq(languoid.id, targetLanguageLink.languoid_id))
      .limit(1);

    return {
      project: projectRecord,
      languoid: languoidRecord ?? null
    };
  }
}

export const projectService = new ProjectService();
