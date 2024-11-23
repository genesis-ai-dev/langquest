import { eq } from 'drizzle-orm';
import { db } from '../db/database';
import { project, language } from '../db/drizzleSchema';
import { aliasedTable } from 'drizzle-orm';

export type ProjectWithRelations = typeof project.$inferSelect & {
  sourceLanguage: typeof language.$inferSelect;
  targetLanguage: typeof language.$inferSelect;
};

export class ProjectService {
  async getAllProjects(): Promise<ProjectWithRelations[]> {
    const sourceLanguage = aliasedTable(language, 'sourceLanguage');
    const targetLanguage = aliasedTable(language, 'targetLanguage');

    const results = await db
      .select({
        id: project.id,
        rev: project.rev,
        createdAt: project.createdAt,
        lastUpdated: project.lastUpdated,
        versionChainId: project.versionChainId,
        name: project.name,
        description: project.description,
        sourceLanguageId: project.sourceLanguageId,
        targetLanguageId: project.targetLanguageId,
        sourceLanguage: {
          id: sourceLanguage.id,
          nativeName: sourceLanguage.nativeName,
          englishName: sourceLanguage.englishName,
        },
        targetLanguage: {
          id: targetLanguage.id,
          nativeName: targetLanguage.nativeName,
          englishName: targetLanguage.englishName,
        },
      })
      .from(project)
      .leftJoin(sourceLanguage, eq(sourceLanguage.id, project.sourceLanguageId))
      .leftJoin(targetLanguage, eq(targetLanguage.id, project.targetLanguageId));


    return results as ProjectWithRelations[];
  }

  async getProjectById(id: string): Promise<ProjectWithRelations | undefined> {
    const sourceLanguage = aliasedTable(language, 'sourceLanguage');
    const targetLanguage = aliasedTable(language, 'targetLanguage');

    const [result] = await db
      .select({
        id: project.id,
        rev: project.rev,
        createdAt: project.createdAt,
        lastUpdated: project.lastUpdated,
        versionChainId: project.versionChainId,
        name: project.name,
        description: project.description,
        sourceLanguageId: project.sourceLanguageId,
        targetLanguageId: project.targetLanguageId,
        sourceLanguage: {
          id: sourceLanguage.id,
          nativeName: sourceLanguage.nativeName,
          englishName: sourceLanguage.englishName,
        },
        targetLanguage: {
          id: targetLanguage.id,
          nativeName: targetLanguage.nativeName,
          englishName: targetLanguage.englishName,
        },
      })
      .from(project)
      .leftJoin(sourceLanguage, eq(sourceLanguage.id, project.sourceLanguageId))
      .leftJoin(targetLanguage, eq(targetLanguage.id, project.targetLanguageId))
      .where(eq(project.id, id));

    return result as ProjectWithRelations | undefined;
  }
}

export const projectService = new ProjectService();