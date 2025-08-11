import type { AssetTemplate } from '@/database_services/assetService';
import { assetService } from '@/database_services/assetService';
import { projectService } from '@/database_services/projectService';
import { questService } from '@/database_services/questService';
import type { DraftProject } from '@/store/localStore';
import type { ProjectTemplate } from './projectTemplates';
import { getTemplateById } from './projectTemplates';

export interface StructuredProjectCreationResult {
    project: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    quests: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    assets: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    totalItems: number;
}

export interface PreparedQuestData {
    name: string;
    description?: string;
    project_id: string;
    creator_id: string;
    visible: boolean;
}

export interface PreparedAssetData {
    name: string;
    source_language_id: string;
    creator_id: string;
    visible: boolean;
    images?: string[] | null;
}

export interface StructuredProjectPreparationResult {
    template: ProjectTemplate;
    questsData: PreparedQuestData[];
    assetsData: PreparedAssetData[];
    assetContentData: { asset_id: string; text: string; creatorId: string }[];
    stats: {
        questCount: number;
        assetCount: number;
        contentCount: number;
    };
}

export interface StructuredProjectCreationProgress {
    stage: 'project' | 'quests' | 'assets' | 'complete';
    current: number;
    total: number;
    message: string;
}

export type ProgressCallback = (progress: StructuredProjectCreationProgress) => void;

export class StructuredProjectCreator {
    // Lazily materialize a single quest (and its assets) for a templated project
    async materializeQuestIfNeeded(
        templateId: string,
        projectId: string,
        projectSourceLanguageId: string,
        questName: string,
        creatorId: string
    ): Promise<{ questId: string; createdAssets: number }> {
        // Check if quest already exists
        const existingQuests = await questService.getQuestsByProjectId(projectId);
        const existing = existingQuests.find(q => q.name === questName);
        if (existing) {
            return { questId: existing.id, createdAssets: 0 };
        }

        const template = getTemplateById(templateId);
        if (!template) throw new Error(`Template with ID '${templateId}' not found`);

        // Create the quest
        const createdQuest = await questService.createQuest({
            name: questName,
            description: undefined,
            project_id: projectId,
            creator_id: creatorId,
            visible: true
        });

        // Generate assets for this quest from the template
        const assetTemplates = template.createAssets(
            projectSourceLanguageId,
            createdQuest.id,
            questName
        );

        if (assetTemplates.length === 0) {
            return { questId: createdQuest.id, createdAssets: 0 };
        }

        // Bulk create assets
        const assetsData = assetTemplates.map(a => ({
            name: a.name,
            source_language_id: a.source_language_id,
            creator_id: creatorId,
            visible: a.visible ?? true,
            images: a.images
        }));

        const createdAssets = await assetService.createAssetsBulk(assetsData);

        // Link assets to quest in original order
        await assetService.createQuestAssetLinksBulk(
            createdAssets.map(a => ({ quest_id: createdQuest.id, asset_id: a.id, creatorId }))
        );

        // Create content where provided
        const contentData = assetTemplates
            .map((t, i) => ({ t, i }))
            .filter(({ t }) => t.text_content)
            .map(({ t, i }) => ({
                asset_id: createdAssets[i]!.id,
                text: t.text_content!,
                creatorId
            }));
        if (contentData.length > 0) {
            await assetService.createAssetContentBulk(contentData);
        }

        return { questId: createdQuest.id, createdAssets: createdAssets.length };
    }

    // Create an asset and ensure its quest exists/link it, used when first translation is submitted
    async materializeForTranslation(
        params: {
            templateId: string;
            projectId: string;
            projectSourceLanguageId: string;
            questName: string; // e.g., "Genesis 1"
            assetName: string; // e.g., "Genesis 1:1"
            creatorId: string;
        }
    ): Promise<{ questId: string; assetId: string }> {
        const template = getTemplateById(params.templateId);
        if (!template) throw new Error(`Template with ID '${params.templateId}' not found`);

        // Ensure quest exists
        const { questId } = await this.materializeQuestIfNeeded(
            params.templateId,
            params.projectId,
            params.projectSourceLanguageId,
            params.questName,
            params.creatorId
        );

        // Check for existing asset by name
        const existingAssets = await assetService.getAllAssets();
        const existing = existingAssets.find(a => a.name === params.assetName);
        let assetId: string;

        if (!existing) {
            const created = await assetService.createAsset({
                name: params.assetName,
                source_language_id: params.projectSourceLanguageId,
                creator_id: params.creatorId,
                visible: true,
                images: null
            });
            assetId = created.id;
        } else {
            assetId = existing.id;
        }

        // Ensure quest-asset link exists
        await assetService.createQuestAssetLinksBulk([
            { quest_id: questId, asset_id: assetId, creatorId: params.creatorId }
        ]);

        return { questId, assetId };
    }

    async createProjectFromTemplate(
        templateId: string,
        draftProject: DraftProject,
        creatorId: string,
        onProgress?: ProgressCallback
    ): Promise<StructuredProjectCreationResult> {
        const template = getTemplateById(templateId);
        if (!template) {
            throw new Error(`Template with ID '${templateId}' not found`);
        }

        console.log(`Creating structured project from template: ${template.name}`);

        try {
            // Step 1: Create the project
            onProgress?.({
                stage: 'project',
                current: 0,
                total: 1,
                message: 'Creating project...'
            });

            const project = await projectService.createProjectFromDraft(draftProject, creatorId);

            onProgress?.({
                stage: 'project',
                current: 1,
                total: 1,
                message: 'Project created successfully'
            });

            // Step 2: Generate all quest data in memory
            onProgress?.({
                stage: 'quests',
                current: 0,
                total: 1,
                message: 'Generating quest data...'
            });

            const questTemplates = template.createQuests(draftProject.source_language_id);
            console.log(`Generated ${questTemplates.length} quest templates`);

            // Prepare quest data for bulk insert
            const questsData: PreparedQuestData[] = questTemplates.map(questTemplate => ({
                name: questTemplate.name,
                description: questTemplate.description,
                project_id: project.id,
                creator_id: creatorId,
                visible: questTemplate.visible
            }));

            // Step 3: Bulk insert all quests at once
            onProgress?.({
                stage: 'quests',
                current: 0,
                total: questsData.length,
                message: `Creating ${questsData.length} quests...`
            });

            const createdQuests = await questService.createQuestsBulk(questsData);

            onProgress?.({
                stage: 'quests',
                current: createdQuests.length,
                total: questsData.length,
                message: `Created ${createdQuests.length} quests`
            });

            // Step 4: Generate all asset data in memory
            onProgress?.({
                stage: 'assets',
                current: 0,
                total: 1,
                message: 'Generating asset data...'
            });

            const allAssetTemplates: { template: AssetTemplate; questId: string }[] = [];

            // Generate asset templates for each quest
            for (let i = 0; i < questTemplates.length; i++) {
                const questTemplate = questTemplates[i];
                const createdQuest = createdQuests[i];

                if (!questTemplate || !createdQuest) continue;

                const assetTemplates = template.createAssets(
                    draftProject.source_language_id,
                    createdQuest.id,
                    questTemplate.name
                );

                for (const assetTemplate of assetTemplates) {
                    allAssetTemplates.push({ template: assetTemplate, questId: createdQuest.id });
                }
            }

            console.log(`Generated ${allAssetTemplates.length} asset templates`);

            // Prepare asset data for bulk insert (without quest_id)
            const assetsData: PreparedAssetData[] = allAssetTemplates.map(({ template }) => ({
                name: template.name,
                source_language_id: template.source_language_id,
                creator_id: creatorId,
                visible: template.visible ?? true,
                images: template.images
            }));

            // Step 5: Bulk insert all assets at once
            onProgress?.({
                stage: 'assets',
                current: 0,
                total: assetsData.length,
                message: `Creating ${assetsData.length} assets...`
            });

            const createdAssets = await assetService.createAssetsBulk(assetsData);

            onProgress?.({
                stage: 'assets',
                current: createdAssets.length,
                total: assetsData.length,
                message: `Created ${createdAssets.length} assets`
            });

            // Step 5.5: Create quest-asset links
            const questAssetLinks = allAssetTemplates.map(({ questId }, index) => ({
                quest_id: questId,
                asset_id: createdAssets[index]!.id,
                creatorId
            }));

            await assetService.createQuestAssetLinksBulk(questAssetLinks);
            console.log(`Created ${questAssetLinks.length} quest-asset links`);

            // Step 6: Prepare asset content data
            const assetContentData = [];
            for (let i = 0; i < allAssetTemplates.length; i++) {
                const assetTemplate = allAssetTemplates[i];
                const createdAsset = createdAssets[i];

                if (!assetTemplate || !createdAsset || !assetTemplate.template.text_content) continue;

                assetContentData.push({
                    asset_id: createdAsset.id,
                    text: assetTemplate.template.text_content,
                    creatorId
                });
            }

            // Step 7: Bulk insert all asset content
            if (assetContentData.length > 0) {
                onProgress?.({
                    stage: 'assets',
                    current: createdAssets.length,
                    total: createdAssets.length + assetContentData.length,
                    message: `Creating ${assetContentData.length} asset contents...`
                });

                await assetService.createAssetContentBulk(assetContentData);

                onProgress?.({
                    stage: 'assets',
                    current: createdAssets.length + assetContentData.length,
                    total: createdAssets.length + assetContentData.length,
                    message: `Created ${assetContentData.length} asset contents`
                });
            }

            console.log(`Successfully created structured project: ${project.name} with ${createdQuests.length} quests and ${createdAssets.length} assets`);

            return {
                project,
                quests: createdQuests,
                assets: createdAssets,
                totalItems: 1 + createdQuests.length + createdAssets.length
            };

        } catch (error) {
            console.error('Error creating structured project:', error);
            throw new Error(`Failed to create structured project: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Prepare all data in memory for confirmation (no database operations)
    prepareProjectFromTemplate(
        templateId: string,
        draftProject: DraftProject
    ): StructuredProjectPreparationResult {
        const template = getTemplateById(templateId);
        if (!template) {
            throw new Error(`Template with ID '${templateId}' not found`);
        }

        console.log(`Preparing structured project from template: ${template.name}`);

        // Step 1: Generate quest templates
        const questTemplates = template.createQuests(draftProject.source_language_id);
        console.log(`Generated ${questTemplates.length} quest templates`);

        // Step 2: Prepare quest data for bulk insert
        const questsData = questTemplates.map(questTemplate => ({
            name: questTemplate.name,
            description: questTemplate.description,
            project_id: 'PLACEHOLDER', // Will be replaced with actual project ID
            creator_id: 'PLACEHOLDER', // Will be replaced with actual creator ID
            visible: questTemplate.visible
        }));

        // Step 3: Generate asset templates for each quest
        const allAssetTemplates: { template: AssetTemplate; questIndex: number }[] = [];

        for (let i = 0; i < questTemplates.length; i++) {
            const questTemplate = questTemplates[i];
            if (!questTemplate) continue;

            const assetTemplates = template.createAssets(
                draftProject.source_language_id,
                'PLACEHOLDER', // Quest ID placeholder
                questTemplate.name
            );

            for (const assetTemplate of assetTemplates) {
                allAssetTemplates.push({ template: assetTemplate, questIndex: i });
            }
        }

        console.log(`Generated ${allAssetTemplates.length} asset templates`);

        // Step 4: Prepare asset data for bulk insert (without quest_id)
        const assetsData = allAssetTemplates.map(({ template }) => ({
            name: template.name,
            source_language_id: template.source_language_id,
            creator_id: 'PLACEHOLDER', // Will be replaced with actual creator ID
            visible: template.visible ?? true,
            images: template.images
        }));

        // Step 5: Prepare asset content data
        const assetContentData = allAssetTemplates
            .filter(({ template }) => template.text_content)
            .map(({ template }) => ({
                asset_id: 'PLACEHOLDER', // Will be replaced with actual asset ID
                text: template.text_content!,
                creatorId: 'PLACEHOLDER' // Will be replaced with actual creator ID
            }));

        return {
            template,
            questsData,
            assetsData,
            assetContentData,
            stats: {
                questCount: questsData.length,
                assetCount: assetsData.length,
                contentCount: assetContentData.length
            }
        };
    }

    // Execute the actual database inserts using prepared data
    async createFromPreparedData(
        draftProject: DraftProject,
        creatorId: string,
        preparedData: StructuredProjectPreparationResult,
        onProgress?: ProgressCallback
    ): Promise<StructuredProjectCreationResult> {
        console.log(`Creating structured project from prepared data: ${draftProject.name}`);

        try {
            // Step 1: Create the project
            onProgress?.({
                stage: 'project',
                current: 0,
                total: 1,
                message: 'Creating project...'
            });

            const project = await projectService.createProjectFromDraft(draftProject, creatorId);

            onProgress?.({
                stage: 'project',
                current: 1,
                total: 1,
                message: 'Project created successfully'
            });

            // Step 2: Replace placeholders in quest data and bulk insert
            onProgress?.({
                stage: 'quests',
                current: 0,
                total: preparedData.questsData.length,
                message: `Creating ${preparedData.questsData.length} quests...`
            });

            const questsDataWithIds: PreparedQuestData[] = preparedData.questsData.map(questData => ({
                ...questData,
                project_id: project.id,
                creator_id: creatorId
            }));

            const createdQuests = await questService.createQuestsBulk(questsDataWithIds);

            onProgress?.({
                stage: 'quests',
                current: createdQuests.length,
                total: preparedData.questsData.length,
                message: `Created ${createdQuests.length} quests`
            });

            // Step 3: Replace placeholders in asset data and bulk insert
            onProgress?.({
                stage: 'assets',
                current: 0,
                total: preparedData.assetsData.length,
                message: `Creating ${preparedData.assetsData.length} assets...`
            });

            const assetsDataWithIds: PreparedAssetData[] = preparedData.assetsData.map(assetData => ({
                ...assetData,
                creator_id: creatorId
            }));

            const createdAssets = await assetService.createAssetsBulk(assetsDataWithIds);

            onProgress?.({
                stage: 'assets',
                current: createdAssets.length,
                total: preparedData.assetsData.length,
                message: `Created ${createdAssets.length} assets`
            });

            // Step 3.5: Create quest-asset links
            // The quest-asset mapping needs to be reconstructed from the template structure
            // For now, we'll recreate the mapping using the same logic as the original template
            const questAssetLinks: { quest_id: string; asset_id: string; creatorId: string }[] = [];
            let assetIndex = 0;

            // Recreate the same structure as in prepareProjectFromTemplate
            for (const [questIndex, questItem] of preparedData.questsData.entries()) {
                const q = createdQuests[questIndex];
                if (!q) continue;

                const questName = questItem.name;
                const assetTemplates = preparedData.template.createAssets(
                    draftProject.source_language_id,
                    'placeholder',
                    questName
                );

                for (const _ of assetTemplates) {
                    const a = createdAssets[assetIndex];
                    if (a) {
                        questAssetLinks.push({ quest_id: q.id, asset_id: a.id, creatorId });
                    }
                    assetIndex++;
                }
            }

            await assetService.createQuestAssetLinksBulk(questAssetLinks);
            console.log(`Created ${questAssetLinks.length} quest-asset links`);

            // Step 4: Replace placeholders in content data and bulk insert
            if (preparedData.assetContentData.length > 0) {
                onProgress?.({
                    stage: 'assets',
                    current: createdAssets.length,
                    total: createdAssets.length + preparedData.assetContentData.length,
                    message: `Creating ${preparedData.assetContentData.length} asset contents...`
                });

                const contentDataWithIds = preparedData.assetContentData.map((contentData, index) => ({
                    ...contentData,
                    asset_id: createdAssets[index]?.id || '',
                    creatorId: creatorId
                }));

                await assetService.createAssetContentBulk(contentDataWithIds);

                onProgress?.({
                    stage: 'assets',
                    current: createdAssets.length + preparedData.assetContentData.length,
                    total: createdAssets.length + preparedData.assetContentData.length,
                    message: `Created ${preparedData.assetContentData.length} asset contents`
                });
            }

            console.log(`Successfully created structured project: ${project.name} with ${createdQuests.length} quests and ${createdAssets.length} assets`);

            return {
                project,
                quests: createdQuests,
                assets: createdAssets,
                totalItems: 1 + createdQuests.length + createdAssets.length
            };

        } catch (error) {
            console.error('Error creating structured project:', error);
            throw new Error(`Failed to create structured project: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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

        // With bulk inserts, this should be much faster - just a few seconds
        const totalTimeMs = 5000; // ~5 seconds for bulk operations

        return {
            questCount: template.questCount,
            assetCount: template.assetCount,
            estimatedTimeMinutes: Math.ceil(totalTimeMs / 1000 / 60)
        };
    }
}

export const structuredProjectCreator = new StructuredProjectCreator();