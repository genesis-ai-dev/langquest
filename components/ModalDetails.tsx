import type { project, quest } from '@/db/drizzleSchema';
import { languoid, project_language_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import type { WithSource } from '@/utils/dbUtils';
import { FEATURE_FLAG_CAN_OFFLOAD_QUEST } from '@/utils/featureFlags';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';
import {
  CloudOffIcon,
  DatabaseIcon,
  HardDriveDownloadIcon,
  InfoIcon,
  LanguagesIcon,
  TypeIcon
} from 'lucide-react-native';
import { default as React } from 'react';
import { View } from 'react-native';
import { Button } from './ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './ui/drawer';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

type Project = typeof project.$inferSelect;
type Quest = typeof quest.$inferSelect;

interface ModalDetailsProps {
  isVisible: boolean;
  contentType: 'project' | 'quest';
  content: WithSource<Project | Quest>;
  onClose: () => void;
  // Quest-specific props
  isDownloaded?: boolean;
  estimatedStorageBytes?: number;
  onOffloadClick?: () => void;
}

export const ModalDetails: React.FC<ModalDetailsProps> = ({
  isVisible,
  contentType,
  content,
  onClose,
  isDownloaded = false,
  estimatedStorageBytes = 0,
  onOffloadClick
}) => {
  const { t } = useLocalization();

  // Format storage size
  const formatStorageSize = (bytes: number): string => {
    if (bytes === 0) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };
  // Fetch project source languoids from project_languoid_link
  const { data: sourceLanguoids = [], isLoading: isSourceLangLoading } =
    useHybridData<
      Pick<typeof languoid.$inferSelect, 'id' | 'name'>,
      typeof languoid.$inferSelect
    >({
      dataType: 'project-source-languoids',
      queryKeyParams: [content.id],
      offlineQuery:
        contentType === 'project' && content.id
          ? toCompilableQuery(
              system.db
                .select({
                  id: languoid.id,
                  name: languoid.name
                })
                .from(project_language_link)
                .innerJoin(
                  languoid,
                  eq(project_language_link.languoid_id, languoid.id)
                )
                .where(
                  and(
                    eq(project_language_link.project_id, content.id),
                    eq(project_language_link.language_type, 'source')
                  )
                )
            )
          : 'SELECT * FROM project_language_link WHERE 1 = 0',
      cloudQueryFn: async () => {
        if (contentType !== 'project' || !content.id) return [];
        const { data, error } = await system.supabaseConnector.client
          .from('project_language_link')
          .select('languoid:languoid_id(id, name)')
          .eq('project_id', content.id)
          .eq('language_type', 'source')
          .not('languoid_id', 'is', null)
          .overrideTypes<{ languoid: typeof languoid.$inferSelect }[]>();
        if (error) throw error;
        return data.map((row) => row.languoid).filter(Boolean);
      },
      transformCloudData: (lang) => ({
        id: lang.id,
        name: lang.name
      }),
      enableCloudQuery: contentType === 'project' && !!content.id,
      enableOfflineQuery: contentType === 'project' && !!content.id
    });

  // Fetch target languoid from project_languoid_link
  const { data: targetLanguoidArr = [], isLoading: isTargetLangLoading } =
    useHybridData<
      Pick<typeof languoid.$inferSelect, 'id' | 'name'>,
      typeof languoid.$inferSelect
    >({
      dataType: 'project-target-languoid',
      queryKeyParams: [content.id],
      offlineQuery:
        contentType === 'project' && content.id
          ? toCompilableQuery(
              system.db
                .select({
                  id: languoid.id,
                  name: languoid.name
                })
                .from(project_language_link)
                .innerJoin(
                  languoid,
                  eq(project_language_link.languoid_id, languoid.id)
                )
                .where(
                  and(
                    eq(project_language_link.project_id, content.id),
                    eq(project_language_link.language_type, 'target')
                  )
                )
                .limit(1)
            )
          : 'SELECT * FROM project_language_link WHERE 1 = 0',
      cloudQueryFn: async () => {
        if (contentType !== 'project' || !content.id) return [];
        const { data, error } = await system.supabaseConnector.client
          .from('project_language_link')
          .select('languoid:languoid_id(id, name)')
          .eq('project_id', content.id)
          .eq('language_type', 'target')
          .not('languoid_id', 'is', null)
          .limit(1)
          .overrideTypes<{ languoid: typeof languoid.$inferSelect }[]>();
        if (error) throw error;
        return data.map((row) => row.languoid).filter(Boolean);
      },
      transformCloudData: (lang) => ({
        id: lang.id,
        name: lang.name
      }),
      enableCloudQuery: contentType === 'project' && !!content.id,
      enableOfflineQuery: contentType === 'project' && !!content.id
    });

  const targetLanguoid = targetLanguoidArr[0];

  // Debug logging
  React.useEffect(() => {
    if (isVisible && contentType === 'quest') {
      console.log('📋 [ModalDetails] Quest modal opened', {
        questId: content.id,
        questName: content.name,
        isDownloaded,
        estimatedStorageBytes,
        hasOffloadClick: !!onOffloadClick,
        contentSource: content.source,
        shouldShowOffload:
          isDownloaded && !!onOffloadClick && content.source !== 'local'
      });
    }
  }, [
    isVisible,
    contentType,
    content,
    isDownloaded,
    estimatedStorageBytes,
    onOffloadClick
  ]);

  return (
    <Drawer
      open={isVisible}
      onOpenChange={onClose}
      snapPoints={FEATURE_FLAG_CAN_OFFLOAD_QUEST ? [430, 470] : [260]}
    >
      <DrawerContent className="bg-background">
        <DrawerHeader>
          <DrawerTitle>{t('info')}</DrawerTitle>
        </DrawerHeader>

        <View className="flex flex-col gap-4">
          <View className="flex-row items-center gap-3">
            <Icon as={TypeIcon} size={20} />
            <Text className="flex-1">{content.name}</Text>
          </View>

          {contentType === 'project' && (
            <View className="flex-row items-center gap-3">
              <Icon as={LanguagesIcon} size={20} />
              {isSourceLangLoading || isTargetLangLoading ? (
                <Text className="text-muted-foreground">{t('loading')}</Text>
              ) : (
                <Text className="flex-1">
                  {sourceLanguoids.length
                    ? sourceLanguoids
                        .map((l) => l.name)
                        .filter(Boolean)
                        .join(', ')
                    : '—'}{' '}
                  → {targetLanguoid?.name || '—'}
                </Text>
              )}
            </View>
          )}

          {'description' in content && content.description && (
            <View className="flex-row items-start gap-3">
              <Icon as={InfoIcon} size={20} className="mt-0.5" />
              <Text className="flex-1 leading-5">
                {content.description.replace(/\\n/g, '\n\n')}
              </Text>
            </View>
          )}

          {/* Quest-specific: Download status and storage */}
          {contentType === 'quest' && (
            <>
              <View className="flex-row items-center gap-3">
                <Icon
                  as={isDownloaded ? HardDriveDownloadIcon : CloudOffIcon}
                  size={20}
                />
                <Text className="flex-1">
                  {isDownloaded
                    ? t('downloaded') || 'Downloaded'
                    : t('notDownloaded') || 'Not Downloaded'}
                </Text>
              </View>

              {isDownloaded && estimatedStorageBytes > 0 && (
                <View className="flex-row items-center gap-3">
                  <Icon as={DatabaseIcon} size={20} />
                  <View className="flex-1 flex-row items-baseline gap-2">
                    <Text className="text-sm text-muted-foreground">
                      {t('storageUsed') || 'Storage Used'}:
                    </Text>
                    <Text className="font-semibold">
                      {formatStorageSize(estimatedStorageBytes)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Offload button - only show if quest is downloaded and cloud */}
              {FEATURE_FLAG_CAN_OFFLOAD_QUEST &&
                isDownloaded &&
                onOffloadClick &&
                content.source !== 'local' && (
                  <View className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <Text className="mb-2 text-sm font-semibold text-destructive">
                      {t('freeUpSpace') || 'Free Up Space'}
                    </Text>
                    <Text className="mb-3 text-sm text-muted-foreground">
                      {t('offloadQuestDescription') ||
                        'Remove this quest and its assets from your device. Your work will remain safely in the cloud and can be re-downloaded anytime.'}
                      {estimatedStorageBytes > 0 && (
                        <Text className="font-semibold">
                          {' '}
                          (~{formatStorageSize(estimatedStorageBytes)})
                        </Text>
                      )}
                    </Text>
                    <Button
                      variant="destructive"
                      onPress={() => {
                        onClose();
                        onOffloadClick();
                      }}
                    >
                      <Icon as={CloudOffIcon} className="text-white" />
                      <Text className="text-white">
                        {t('offloadQuest') || 'Offload from Device'}
                      </Text>
                    </Button>
                  </View>
                )}
            </>
          )}
        </View>
      </DrawerContent>
    </Drawer>
  );
};
