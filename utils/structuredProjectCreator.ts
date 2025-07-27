import { assetService } from '@/database_services/assetService';
import { projectService } from '@/database_services/projectService';
import { questService } from '@/database_services/questService';
import type { DraftProject } from '@/store/localStore';
import { getTemplateById } from './projectTemplates';

export interface StructuredProjectCreationResult {
    project: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Project type from service
    quests: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any -- Quest type from service
    assets: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any -- Asset type from service
    totalItems: number;
}

export interface StructuredProjectCreationProgress {
    stage: 'project' | 'quests' | 'assets' | 'complete';
    current: number;
    total: number;
    message: string;
}

export type ProgressCallback = (progress: StructuredProjectCreationProgress) => void;

export class StructuredProjectCreator {
    async createProjectFromTemplate(
        templateId: string,
        draftProject: DraftProject,
        creatorId: string,
        onProgress?: ProgressCallback
    ): Promise<StructuredProjectCreationResult> {
        // Get template
        const template = getTemplateById(templateId);
        if (!template) {
            throw new Error(`Template with ID "${templateId}" not found`);
        }

        console.log(`Creating structured project from template: ${template.name}`);

        // Step 1: Create the project
        onProgress?.({
            stage: 'project',
            current: 0,
            total: 1,
            message: 'Creating project...'
        });

        const project = await projectService.createProjectFromDraft(draftProject, creatorId);
        console.log('Created project:', project);

        onProgress?.({
            stage: 'project',
            current: 1,
            total: 1,
            message: 'Project created successfully'
        });

        // Step 2: Generate quest templates
        const questTemplates = template.createQuests(draftProject.source_language_id);
        console.log(`Generated ${questTemplates.length} quest templates`);

        // Step 3: Create quests in batches
        onProgress?.({
            stage: 'quests',
            current: 0,
            total: questTemplates.length,
            message: 'Creating quests...'
        });

        const createdQuests = [];
        const QUEST_BATCH_SIZE = 10; // Process quests in batches

        for (let i = 0; i < questTemplates.length; i += QUEST_BATCH_SIZE) {
            const batch = questTemplates.slice(i, i + QUEST_BATCH_SIZE);

            const batchPromises = batch.map(async (questTemplate) => {
                return await questService.createQuestFromDraft(
                    {
                        project_id: project.id, // This will be ignored, but needed for type
                        name: questTemplate.name,
                        description: questTemplate.description,
                        visible: questTemplate.visible,
                        id: '', // Will be generated
                        created_at: new Date(),
                        last_updated: new Date()
                    },
                    project.id,
                    creatorId
                );
            });

            const batchResults = await Promise.all(batchPromises);
            createdQuests.push(...batchResults);

            onProgress?.({
                stage: 'quests',
                current: Math.min(i + QUEST_BATCH_SIZE, questTemplates.length),
                total: questTemplates.length,
                message: `Created ${Math.min(i + QUEST_BATCH_SIZE, questTemplates.length)} of ${questTemplates.length} quests`
            });
        }

        console.log(`Created ${createdQuests.length} quests`);

        // Step 4: Create assets for each quest
        onProgress?.({
            stage: 'assets',
            current: 0,
            total: createdQuests.length,
            message: 'Creating assets...'
        });

        const allAssets = [];
        const ASSET_BATCH_SIZE = 5; // Smaller batches for assets since there are many per quest

        for (let questIndex = 0; questIndex < createdQuests.length; questIndex++) {
            const quest = createdQuests[questIndex];
            if (!quest) continue; // Safety check

            // Generate asset templates for this quest
            const assetTemplates = template.createAssets(
                draftProject.source_language_id,
                quest.id,
                quest.name
            );

            // Create assets in batches
            for (let i = 0; i < assetTemplates.length; i += ASSET_BATCH_SIZE) {
                const batch = assetTemplates.slice(i, i + ASSET_BATCH_SIZE);

                const batchAssets = await assetService.createMultipleAssetsFromTemplates(
                    batch,
                    creatorId
                );

                allAssets.push(...batchAssets);
            }

            onProgress?.({
                stage: 'assets',
                current: questIndex + 1,
                total: createdQuests.length,
                message: `Created assets for quest ${questIndex + 1} of ${createdQuests.length} (${allAssets.length} total assets)`
            });
        }

        console.log(`Created ${allAssets.length} assets total`);

        onProgress?.({
            stage: 'complete',
            current: 1,
            total: 1,
            message: `Successfully created ${template.name} project with ${createdQuests.length} quests and ${allAssets.length} assets`
        });

        return {
            project,
            quests: createdQuests,
            assets: allAssets,
            totalItems: 1 + createdQuests.length + allAssets.length
        };
    }

    estimateCreationTime(templateId: string): {
        questCount: number;
        assetCount: number;
        estimatedTimeMinutes: number;
    } {
        const template = getTemplateById(templateId);
        if (!template) {
            throw new Error(`Template with ID "${templateId}" not found`);
        }

        // Rough estimates based on database operations
        const questCreationTimeMs = 50; // ~50ms per quest
        const assetCreationTimeMs = 100; // ~100ms per asset (includes content)

        const totalTimeMs =
            (template.questCount * questCreationTimeMs) +
            (template.assetCount * assetCreationTimeMs);

        return {
            questCount: template.questCount,
            assetCount: template.assetCount,
            estimatedTimeMinutes: Math.ceil(totalTimeMs / 1000 / 60)
        };
    }
}

export const structuredProjectCreator = new StructuredProjectCreator(); 