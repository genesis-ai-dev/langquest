import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { LayerType, useStatusContext } from '@/contexts/StatusContext';
import type { Project } from '@/database_services/projectService';
import type { LayerStatus } from '@/database_services/types';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { Language } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import {
  useHybridData,
  useItemDownloadStatus
} from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { eq } from 'drizzle-orm';
import {
  BookIcon,
  CrownIcon,
  EyeOffIcon,
  HardDriveIcon,
  LockIcon,
  UserIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

export function ProjectListItem({
  project,
  className
}: {
  project: Project & { source: HybridDataSource };
  className?: string;
}) {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const { goToProject } = useAppNavigation();
  const layerStatus = useStatusContext();
  const isDownloaded = useItemDownloadStatus(project, currentUser?.id);

  const [showPrivateModal, setShowPrivateModal] = useState(false);

  const { membership } = useUserPermissions(
    project.id,
    'open_project',
    project.private
  );

  const { allowEditing: _allowEditing, invisible: _invisible } =
    layerStatus.getStatusParams(
      LayerType.PROJECT,
      project.id || '',
      project as LayerStatus
    );

  const { data: sourceLanguages = [] } = useHybridData<Language, Language>({
    dataType: 'project-source-languages',
    queryKeyParams: [project.id],
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        where: (language) => eq(language.id, language.id),
        // Placeholder; PowerSync offline query requires a compilable query; we will not use offline here
        limit: 0
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('project_language_link')
        .select('language:language_id(id, native_name, english_name)')
        .eq('project_id', project.id)
        .eq('language_type', 'source')
        .overrideTypes<{ language: Language }[]>();
      if (error) throw error;
      return data.map((row) => row.language);
    }
  });

  const { data: targetLangArr = [] } = useHybridData<Language>({
    dataType: 'project-target-language',
    queryKeyParams: [project.target_language_id],
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        where: (language, { eq }) => eq(language.id, project.target_language_id)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('language')
        .select('*')
        .eq('id', project.target_language_id)
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    }
  });

  const targetLanguage = targetLangArr[0];

  const getLanguageDisplayName = (
    language: Pick<Language, 'native_name' | 'english_name'> | undefined
  ) => {
    if (!language) return 'Unknown';
    return language.native_name || language.english_name || 'Unknown';
  };

  const handleMembershipGranted = () => {
    // Navigate to project after membership is granted
    layerStatus.setLayerStatus(
      LayerType.PROJECT,
      project as LayerStatus,
      project.id
    );
    goToProjectHelper();
  };

  const handleBypass = () => {
    // Allow viewing the project even without membership
    layerStatus.setLayerStatus(
      LayerType.PROJECT,
      project as LayerStatus,
      project.id
    );
    goToProjectHelper();
  };

  function goToProjectHelper() {
    goToProject({
      id: project.id,
      name: project.name,
      template: project.template,
      projectData: project  // Pass full project data for instant rendering!
    });
  }

  return (
    <>
      <Pressable
        className={className}
        key={project.id}
        onPress={() => goToProjectHelper()}
      >
        <Card className={cn(className, !project.visible && 'opacity-50')}>
          <CardHeader className="flex flex-row items-start justify-between">
            <View className="flex flex-1 gap-1">
              <View className="flex flex-row items-center">
                <View className="flex flex-1 flex-row gap-2">
                  {(project.private ||
                    !!membership ||
                    project.source === 'local') && (
                    <View className="flex flex-row items-center gap-1.5">
                      {!project.visible && (
                        <Icon
                          as={EyeOffIcon}
                          className="text-secondary-foreground"
                        />
                      )}
                      {project.source === 'local' && (
                        <Icon
                          as={HardDriveIcon}
                          className="text-secondary-foreground"
                        />
                      )}
                      {project.private && (
                        <Icon
                          as={LockIcon}
                          className="text-secondary-foreground"
                        />
                      )}
                      {project.template === 'bible' && (
                        <Icon
                          as={BookIcon}
                          className="text-secondary-foreground"
                        />
                      )}
                      {membership === 'owner' && (
                        <Icon as={CrownIcon} className="text-primary" />
                      )}
                      {membership === 'member' && (
                        <Icon as={UserIcon} className="text-primary" />
                      )}
                    </View>
                  )}
                  <CardTitle numberOfLines={2} className="flex flex-1">
                    {project.name}
                  </CardTitle>
                </View>
                {isDownloaded && (
                  <DownloadIndicator
                    isFlaggedForDownload={true}
                    isLoading={false}
                    onPress={() => undefined} // Non-interactive
                    downloadType="project"
                    stats={{
                      totalAssets: 0,
                      totalQuests: 0
                    }}
                  />
                )}
              </View>
              <CardDescription>
                <Text>
                  {`${
                    sourceLanguages.length
                      ? sourceLanguages
                          .map((l) => getLanguageDisplayName(l))
                          .join(', ')
                      : '—'
                  } → ${getLanguageDisplayName(targetLanguage)}`}
                </Text>
              </CardDescription>
            </View>
          </CardHeader>
          <CardContent>
            <Text numberOfLines={4}>{project.description}</Text>
          </CardContent>
        </Card>
      </Pressable>

      {/* Private Access Gate Modal */}
      <PrivateAccessGate
        projectId={project.id}
        projectName={project.name}
        isPrivate={project.private || false}
        action="contribute"
        modal={true}
        isVisible={showPrivateModal}
        onClose={() => setShowPrivateModal(false)}
        onMembershipGranted={handleMembershipGranted}
        onBypass={handleBypass}
        showViewProjectButton={true}
        viewProjectButtonText={t('viewProjectLimitedAccess')}
      />
    </>
  );
}
