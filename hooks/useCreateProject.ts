import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import type { CreateProjectSubmitValues } from '@/views/new/create-project/schema';
import { resolveTable } from '@/utils/dbUtils';
import { ensureLanguoidDownloadProfile } from '@/utils/languoidUtils';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export type { CreateProjectSubmitValues } from '@/views/new/create-project/schema';

export function useCreateProject(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const { db } = system;
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: CreateProjectSubmitValues) => {
      if (!currentUser?.id) {
        throw new Error('Must be logged in to create projects');
      }

      const description = values.description?.trim();

      await ensureLanguoidDownloadProfile(
        values.target_languoid_id,
        currentUser.id
      );

      if (values.template === 'fia') {
        await ensureLanguoidDownloadProfile(
          values.source_languoid_id,
          currentUser.id
        );
      }

      await db.transaction(async (tx) => {
        const { target_languoid_id, template, ...projectValues } = values;
        const [newProject] = await tx
          .insert(resolveTable('project', { localOverride: false }))
          .values({
            name: projectValues.name,
            description: description || undefined,
            private: projectValues.private,
            visible: projectValues.visible,
            template,
            target_language_id: target_languoid_id,
            creator_id: currentUser.id,
            download_profiles: [currentUser.id]
          })
          .returning();
        if (!newProject) throw new Error('Failed to create project');

        await tx
          .insert(
            resolveTable('profile_project_link', { localOverride: false })
          )
          .values({
            id: `${currentUser.id}_${newProject.id}`,
            project_id: newProject.id,
            profile_id: currentUser.id,
            membership: 'owner'
          });

        const projectLanguageLinkSynced = resolveTable(
          'project_language_link',
          { localOverride: false }
        );

        await tx.insert(projectLanguageLinkSynced).values({
          project_id: newProject.id,
          language_id: null,
          languoid_id: target_languoid_id,
          language_type: 'target',
          active: true,
          download_profiles: [currentUser.id]
        });

        if (values.template === 'fia') {
          await tx.insert(projectLanguageLinkSynced).values({
            project_id: newProject.id,
            language_id: null,
            languoid_id: values.source_languoid_id,
            language_type: 'source',
            active: true,
            download_profiles: [currentUser.id]
          });
        }
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['my-projects'],
        exact: false
      });
      await queryClient.invalidateQueries({
        queryKey: ['all-projects'],
        exact: false
      });
      options?.onSuccess?.();
    },
    onError: (error) => {
      console.error('Failed to create project', error);
      options?.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });
}
