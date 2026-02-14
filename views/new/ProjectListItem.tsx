import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { Button } from '@/components/ui/button';
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
import type { languoid } from '@/db/drizzleSchema';
import { project_language_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLanguoidNames } from '@/hooks/db/useLanguoids';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/utils/styleUtils';
import type { HybridDataSource } from '@/views/new/useHybridData';
import {
  useHybridData,
  useItemDownloadStatus
} from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, isNotNull } from 'drizzle-orm';
import {
  BookIcon,
  CrownIcon,
  EyeOffIcon,
  HardDriveIcon,
  LockIcon,
  MailIcon,
  UserIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

type Languoid = typeof languoid.$inferSelect;

export function ProjectListItem({
  project,
  isInvited = false,
  className
}: {
  project: Project & { source: HybridDataSource };
  isInvited?: boolean;
  className?: string;
}) {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const { goToProject, goToNotifications } = useAppNavigation();
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

  // Get source languoids from project_language_link
  const { data: sourceLanguoidLinksRaw = [] } = useHybridData<{
    languoid_id: string | null;
  }>({
    dataType: 'project-source-languoid-ids',
    queryKeyParams: [project.id],
    offlineQuery: toCompilableQuery(
      system.db
        .select({ languoid_id: project_language_link.languoid_id })
        .from(project_language_link)
        .where(
          and(
            eq(project_language_link.project_id, project.id),
            eq(project_language_link.language_type, 'source'),
            isNotNull(project_language_link.languoid_id)
          )
        )
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('project_language_link')
        .select('languoid_id')
        .eq('project_id', project.id)
        .eq('language_type', 'source')
        .not('languoid_id', 'is', null)
        .overrideTypes<{ languoid_id: string | null }[]>();
      if (error) throw error;
      return data;
    }
  });

  // Filter out nulls and assert type
  const sourceLanguoidLinks = sourceLanguoidLinksRaw
    .filter((link) => link.languoid_id !== null)
    .map((link) => ({ ...link, languoid_id: link.languoid_id! }));

  // Get target languoid from project_language_link
  const { data: targetLanguoidLinkRaw = [] } = useHybridData<{
    languoid_id: string | null;
  }>({
    dataType: 'project-target-languoid-id',
    queryKeyParams: [project.id],
    offlineQuery: toCompilableQuery(
      system.db
        .select({ languoid_id: project_language_link.languoid_id })
        .from(project_language_link)
        .where(
          and(
            eq(project_language_link.project_id, project.id),
            eq(project_language_link.language_type, 'target'),
            isNotNull(project_language_link.languoid_id)
          )
        )
        .limit(1)
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('project_language_link')
        .select('languoid_id')
        .eq('project_id', project.id)
        .eq('language_type', 'target')
        .not('languoid_id', 'is', null)
        .limit(1)
        .overrideTypes<{ languoid_id: string | null }[]>();
      if (error) throw error;
      return data;
    }
  });

  // Filter out nulls and assert type
  const targetLanguoidLink = targetLanguoidLinkRaw
    .filter((link) => link.languoid_id !== null)
    .map((link) => ({ ...link, languoid_id: link.languoid_id! }));

  const sourceLanguoidIds = sourceLanguoidLinks
    .map((link) => link.languoid_id)
    .filter(Boolean);
  const targetLanguoidId = targetLanguoidLink[0]?.languoid_id;

  // Fetch languoid names
  const { languoids: sourceLanguoids } = useLanguoidNames(sourceLanguoidIds);
  const { languoids: targetLanguoids } = useLanguoidNames(
    targetLanguoidId ? [targetLanguoidId] : []
  );
  const targetLanguoid = targetLanguoids[0];

  const getLanguoidDisplayName = (
    languoid: Pick<Languoid, 'name'> | undefined
  ) => {
    if (!languoid) return 'Unknown';
    return languoid.name || 'Unknown';
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
      projectData: project // Pass full project data for instant rendering!
    });
  }

  return (
    <>
      <Pressable
        className={className}
        key={project.id}
        onPress={() => goToProjectHelper()}
      >
        <Card
          className={cn(
            className,
            !project.visible && 'opacity-50',
            isInvited && 'border-2 border-primary bg-primary/5 shadow-md'
          )}
        >
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <View className="flex flex-1 gap-1">
              <CardTitle numberOfLines={2}>{project.name}</CardTitle>
              <CardDescription>
                <Text>
                  {sourceLanguoids.length > 0
                    ? `${sourceLanguoids
                        .map((l) => getLanguoidDisplayName(l))
                        .join(
                          ', '
                        )} → ${getLanguoidDisplayName(targetLanguoid)}`
                    : getLanguoidDisplayName(targetLanguoid)}
                </Text>
              </CardDescription>
            </View>
            <View className="flex flex-shrink-0 flex-row items-center gap-1.5">
              {isInvited && (
                <View className="flex flex-row items-center gap-1.5">
                  <View className="rounded-full bg-primary px-2 py-0.5">
                    <Text className="text-xs font-semibold text-primary-foreground">
                      {t('invited')}
                    </Text>
                  </View>
                  <Icon as={MailIcon} className="text-primary" size={16} />
                </View>
              )}
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
                    <Icon as={LockIcon} className="text-secondary-foreground" />
                  )}
                  {(project.template === 'bible' ||
                    project.template === 'fia') && (
                    <Icon as={BookIcon} className="text-secondary-foreground" />
                  )}
                  {membership === 'owner' && (
                    <Icon as={CrownIcon} className="text-primary" />
                  )}
                  {membership === 'member' && (
                    <Icon as={UserIcon} className="text-primary" />
                  )}
                </View>
              )}
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
          </CardHeader>
          {(project.description || isInvited) && (
            <CardContent>
              {project.description && (
                <Text numberOfLines={4}>{project.description}</Text>
              )}
              {isInvited && (
                <View
                  className={cn(
                    'flex-row gap-2',
                    project.description && 'mt-3'
                  )}
                >
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 flex-row items-center gap-2"
                    onPress={() => {
                      goToNotifications();
                    }}
                  >
                    <Icon
                      as={MailIcon}
                      size={16}
                      className="text-primary-foreground"
                    />
                    <Text className="text-primary-foreground">
                      {t('viewInvitation')}
                    </Text>
                  </Button>
                </View>
              )}
            </CardContent>
          )}
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
