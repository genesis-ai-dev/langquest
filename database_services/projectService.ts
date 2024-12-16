import { eq } from 'drizzle-orm';
// import { db } from '../db/database';
import { project, language } from '../db/drizzleSchema';
import { aliasedTable } from 'drizzle-orm';
import { system } from '../db/powersync/system';

const { db } = system;

export type ProjectWithRelations = typeof project.$inferSelect & {
  source_language: typeof language.$inferSelect;
  target_language: typeof language.$inferSelect;
};

export class ProjectService {
  async getAllProjects(): Promise<ProjectWithRelations[]> {
    const source_language = aliasedTable(language, 'source_language');
    const target_language = aliasedTable(language, 'target_language');

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
        source_language: {
          id: source_language.id,
          native_name: source_language.native_name,
          english_name: source_language.english_name,
        },
        target_language: {
          id: target_language.id,
          native_name: target_language.native_name,
          english_name: target_language.english_name,
        },
      })
      .from(project)
      .leftJoin(source_language, eq(source_language.id, project.source_language_id))
      .leftJoin(target_language, eq(target_language.id, project.target_language_id));


    return results as ProjectWithRelations[];
  }

  async getProjectById(id: string): Promise<ProjectWithRelations | undefined> {
    const source_language = aliasedTable(language, 'source_language');
    const target_language = aliasedTable(language, 'target_language');

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
        source_language: {
          id: source_language.id,
          native_name: source_language.native_name,
          english_name: source_language.english_name,
        },
        target_language: {
          id: target_language.id,
          native_name: target_language.native_name,
          english_name: target_language.english_name,
        },
      })
      .from(project)
      .leftJoin(source_language, eq(source_language.id, project.source_language_id))
      .leftJoin(target_language, eq(target_language.id, project.target_language_id))
      .where(eq(project.id, id));

    return result as ProjectWithRelations | undefined;
  }
}

export const projectService = new ProjectService();