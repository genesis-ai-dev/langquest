import type { language, project, quest } from '@/db/drizzleSchema';
import {
  language as languageTable,
  project_language_link
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import type { WithSource } from '@/utils/dbUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';
import {
  CloudOffIcon,
  DatabaseIcon,
  HardDriveDownloadIcon,
  InfoIcon,
  Languages,
  XIcon
} from 'lucide-react-native';
import { default as React } from 'react';
import { View } from 'react-native';
import { Button } from './ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from './ui/drawer';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

type Project = typeof project.$inferSelect;
type Quest = typeof quest.$inferSelect;
type Language = typeof language.$inferSelect;

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
  // Fetch project source languages from project_language_link and single target from project
  // let sourceLanguages: Pick<Language, 'id' | 'native_name' | 'english_name'>[] =
  //   [];
  const { data: sourceLanguages, isLoading: isSourceLangLoading } =
    useHybridData({
      dataType: 'project-source-languages',
      queryKeyParams: [content.id],
      offlineQuery:
        contentType === 'project' && content.id
          ? toCompilableQuery(
              system.db
                .select({
                  id: languageTable.id,
                  native_name: languageTable.native_name,
                  english_name: languageTable.english_name
                })
                .from(project_language_link)
                .innerJoin(
                  languageTable,
                  eq(project_language_link.language_id, languageTable.id)
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
          .select('language:language_id(id, native_name, english_name)')
          .eq('project_id', content.id)
          .eq('language_type', 'source')
          .overrideTypes<{ language: Language }[]>();
        if (error) throw error;
        return data.map((row) => row.language);
      }
      // transformCloudData: (lang) => ({
      //   id: lang.id,
      //   native_name: lang.native_name,
      //   english_name: lang.english_name
      // })
    });

  const { data: targetLangArr = [], isLoading: isTargetLangLoading } =
    useHybridData({
      dataType: 'project-target-language',
      queryKeyParams: [
        contentType === 'project' && content.id
          ? (content as Project).target_language_id
          : null
      ],
      offlineQuery: toCompilableQuery(
        system.db.query.language.findMany({
          columns: { id: true, native_name: true, english_name: true },
          where: eq(languageTable.id, (content as Project).target_language_id)
        })
      ),
      cloudQueryFn: async () => {
        const { data, error } = await system.supabaseConnector.client
          .from('language')
          .select('id, native_name, english_name')
          .eq('id', (content as Project).target_language_id)
          .overrideTypes<
            Pick<Language, 'id' | 'native_name' | 'english_name'>[]
          >();
        if (error) throw error;
        return data;
      },
      // transformCloudData: (lang) => ({
      //   id: lang.id,
      //   native_name: lang.native_name,
      //   english_name: lang.english_name
      // }),
      enableCloudQuery: contentType === 'project' && !!content.id,
      enableOfflineQuery: contentType === 'project' && !!content.id
    });

  const targetLanguage =
    targetLangArr.length > 0 && targetLangArr[0] !== undefined
      ? targetLangArr[0]
      : null;

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
    <Drawer open={isVisible} onOpenChange={onClose} snapPoints={['50%', '90%']}>
      <DrawerContent className="bg-background px-4 pb-4">
        <DrawerHeader className="flex-row items-center justify-between">
          <DrawerTitle>
            {contentType === 'project' ? t('project') : t('quest')}
          </DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon">
              <Icon as={XIcon} size={24} />
            </Button>
          </DrawerClose>
        </DrawerHeader>

        <View className="flex-1 gap-4">
          <View className="border-b border-border pb-3">
            <Text className="text-lg font-bold">{content.name}</Text>
          </View>

          {contentType === 'project' && (
            <View className="flex-row items-center gap-3">
              <Icon as={Languages} size={20} />
              {isSourceLangLoading || isTargetLangLoading ? (
                <Text className="text-muted-foreground">{t('loading')}</Text>
              ) : (
                <Text className="flex-1">
                  {sourceLanguages.length
                    ? sourceLanguages
                        .map((l) => l.native_name || l.english_name)
                        .filter(Boolean)
                        .join(', ')
                    : '—'}{' '}
                  →{' '}
                  {targetLanguage?.native_name || targetLanguage?.english_name}
                </Text>
              )}
            </View>
          )}

          {'description' in content && content.description && (
            <View className="flex-row items-start gap-3">
              <Icon as={InfoIcon} size={20} className="mt-0.5" />
              <Text className="flex-1 text-justify leading-5">
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
              {isDownloaded && onOffloadClick && content.source !== 'local' && (
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
