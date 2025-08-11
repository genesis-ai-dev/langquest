import type { DraftProject } from '@/store/localStore';
import { eq } from 'drizzle-orm';
import { profile_project_link, project } from '../db/drizzleSchema';
import { system } from '../db/powersync/system';

export type Project = typeof project.$inferSelect;
export type CreateProjectData = Omit<typeof project.$inferInsert, 'id' | 'created_at' | 'last_updated' | 'active'>;

// Generate a UUID compatible with React Native (mimics SQLite's randomblob approach)
const generateUUID = (): string => {
  const randomBytes = new Array(16).fill(0).map(() => Math.floor(Math.random() * 256));
  const hex = randomBytes.map(b => b.toString(16).padStart(2, '0')).join('');
  return hex.toLowerCase();
};

export class ProjectService {
  async getAllProjects(): Promise<Project[]> {
    console.log('getAllProjects trying to fetch projects');
    const results = await system.db.select().from(project);
    console.log('getAllProjects fetched projects', results);
    return results;
  }

  async getProjectById(id: string) {
    const [result] = await system.db.select().from(project).where(eq(project.id, id));
    return result;
  }

  async createProject(projectData: CreateProjectData): Promise<Project> {
    console.log('createProject attempting to create project:', projectData);

    const [newProject] = await system.db.insert(project).values({
      ...projectData,
      download_profiles: projectData.creator_id ? [projectData.creator_id] : [],
      templates: (projectData as any).templates || null // eslint-disable-line @typescript-eslint/no-explicit-any
    }).returning();

    if (!newProject) {
      throw new Error('Failed to create project');
    }

    console.log('Project created:', newProject);

    // Create project membership for the creator
    if (projectData.creator_id) {
      const linkId = generateUUID();
      console.log('Creating membership link with ID:', linkId);

      await system.db.insert(profile_project_link).values({
        id: linkId,
        profile_id: projectData.creator_id,
        project_id: newProject.id,
        membership: 'owner'
      });

      console.log('Membership created successfully');
    }

    return newProject;
  }

  async createProjectFromDraft(
    draftProject: DraftProject,
    creatorId: string,
    extra?: Partial<CreateProjectData>
  ): Promise<Project> {
    const projectData: CreateProjectData = {
      name: draftProject.name,
      description: draftProject.description,
      source_language_id: draftProject.source_language_id,
      target_language_id: draftProject.target_language_id,
      creator_id: creatorId,
      private: draftProject.private,
      visible: draftProject.visible,
      ...(extra || {})
    };

    return this.createProject(projectData);
  }
}

export const projectService = new ProjectService();
