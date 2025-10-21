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
import { InfoIcon, Languages, XIcon } from 'lucide-react-native';
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
}

export const ModalDetails: React.FC<ModalDetailsProps> = ({
  isVisible,
  contentType,
  content,
  onClose
}) => {
  const { t } = useLocalization();
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
        </View>
      </DrawerContent>
    </Drawer>
  );
};
