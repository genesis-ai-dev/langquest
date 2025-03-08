import { eq } from 'drizzle-orm';
import { project } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type Project = typeof project.$inferSelect;

const { db } = system;

export class ProjectService {
  async getAllProjects(): Promise<Project[]> {
    const results = await db.select().from(project);
    return results;
  }

  async getProjectById(id: string): Promise<Project | null> {
    const [result] = await db.select().from(project).where(eq(project.id, id));
    return result;
  }
}

export const projectService = new ProjectService();
