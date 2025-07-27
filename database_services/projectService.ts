import type { DraftProject } from '@/store/localStore';
import { eq } from 'drizzle-orm';
import { profile_project_link, project } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type Project = typeof project.$inferSelect;
export type CreateProjectData = Omit<typeof project.$inferInsert, 'id' | 'created_at' | 'last_updated' | 'active'>;

const { db } = system;

export class ProjectService {
  async getAllProjects(): Promise<Project[]> {
    console.log('getAllProjects trying to fetch projects');
    const results = await db.select().from(project);
    console.log('getAllProjects fetched projects', results);
    return results;
  }

  async getProjectById(id: string) {
    const [result] = await db.select().from(project).where(eq(project.id, id));
    return result;
  }

  async createProject(projectData: CreateProjectData): Promise<Project> {
    console.log('createProject attempting to create project:', projectData);

    // Insert the project
    const [newProject] = await db.insert(project).values({
      ...projectData,
      download_profiles: projectData.creator_id ? [projectData.creator_id] : []
    }).returning();

    if (!newProject) {
      throw new Error('Failed to create project');
    }

    // Create project membership link to give creator owner status
    if (projectData.creator_id) {
      // Generate UUID for the link (using same pattern as schema)
      const linkId = crypto.randomUUID().replace(/-/g, '').toLowerCase();

      await db.insert(profile_project_link).values({
        id: linkId,
        profile_id: projectData.creator_id,
        project_id: newProject.id,
        membership: 'owner'
        // active, created_at, last_updated will use their defaults
      });
      console.log('Created project membership link for owner:', projectData.creator_id);
    }

    console.log('createProject successfully created project:', newProject);
    return newProject;
  }

  async createProjectFromDraft(draftProject: DraftProject, creatorId: string): Promise<Project> {
    const projectData: CreateProjectData = {
      name: draftProject.name,
      description: draftProject.description,
      source_language_id: draftProject.source_language_id,
      target_language_id: draftProject.target_language_id,
      creator_id: creatorId,
      private: draftProject.private,
      visible: draftProject.visible
    };

    return this.createProject(projectData);
  }
}

export const projectService = new ProjectService();
