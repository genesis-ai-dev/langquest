import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { project, language } from '../db/drizzleSchema';
import { aliasedTable } from 'drizzle-orm';
import { system } from '../db/powersync/system';

export type Project = typeof project.$inferSelect;

const { db } = system;

export class ProjectService {
  async getAllProjects(): Promise<Project[]> {
    // const source_language = aliasedTable(language, 'source_language');
    // const target_language = aliasedTable(language, 'target_language');
    // console.log('Source language:', source_language);
    // console.log('Target language:', target_language);

    // First get all projects without joins
    const basicProjects = await db
      .select()
      .from(project);

    // Then get projects with language joins
    const results = await db
      .select({
        id: project.id,
        rev: project.rev,
        created_at: project.created_at,
        last_updated: project.last_updated,
        version_chain_id: project.version_chain_id,
        name: project.name,
        description: project.description,
        source_language_id: project.source_language_id,
        target_language_id: project.target_language_id,
      })
      .from(project);

    return results;
  }

  async getProjectById(id: string): Promise<Project[]> {
    // const source_language = aliasedTable(language, 'source_language');
    // const target_language = aliasedTable(language, 'target_language');

    const [result] = await db
      .select({
        id: project.id,
        rev: project.rev,
        created_at: project.created_at,
        last_updated: project.last_updated,
        version_chain_id: project.version_chain_id,
        name: project.name,
        description: project.description,
        source_language_id: project.source_language_id,
        target_language_id: project.target_language_id,
      })
      .from(project)
      .where(eq(project.id, id));

    return result;
  }
}

export const projectService = new ProjectService();