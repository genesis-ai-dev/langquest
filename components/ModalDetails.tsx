import type { language, project, quest } from '@/db/drizzleSchema';
import {
  language as languageTable,
  project_language_link
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import type { WithSource } from '@/views/new/useHybridData';
import { useHybridData } from '@/views/new/useHybridData';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';
import { default as React } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
    useHybridData<
      Pick<Language, 'id' | 'native_name' | 'english_name'>,
      Language
    >({
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
      },
      transformCloudData: (lang) => ({
        id: lang.id,
        native_name: lang.native_name,
        english_name: lang.english_name
      })
    });

  const { data: targetLangArr = [], isLoading: isTargetLangLoading } =
    useHybridData<
      Pick<Language, 'id' | 'native_name' | 'english_name'>,
      Language
    >({
      dataType: 'project-target-language',
      queryKeyParams: [
        contentType === 'project' && content.id
          ? (content as Project).target_language_id
          : null
      ],
      offlineQuery:
        contentType === 'project' && content.id
          ? toCompilableQuery(
              system.db.query.language.findMany({
                columns: { id: true, native_name: true, english_name: true },
                where: eq(
                  languageTable.id,
                  (content as Project).target_language_id
                )
              })
            )
          : 'SELECT * FROM language WHERE 1 = 0',
      cloudQueryFn: async () => {
        if (contentType !== 'project' || !content.id) return [];
        const { data, error } = await system.supabaseConnector.client
          .from('language')
          .select('id, native_name, english_name')
          .eq('id', (content as Project).target_language_id)
          .overrideTypes<Language[]>();
        if (error) throw error;
        return data;
      },
      transformCloudData: (lang) => ({
        id: lang.id,
        native_name: lang.native_name,
        english_name: lang.english_name
      })
    });

  const targetLanguage =
    targetLangArr.length > 0 && targetLangArr[0] !== undefined
      ? targetLangArr[0]
      : null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeArea} onPress={onClose} />
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {contentType === 'project' ? t('project') : t('quest')}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionDecoration}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.title}>{content.name}</Text>
            </Text>
          </View>

          {contentType === 'project' && (
            <View style={styles.infoRow}>
              <Ionicons name="language-outline" size={20} color={colors.text} />
              {isSourceLangLoading || isTargetLangLoading ? (
                <Text style={styles.infoText}>t('loading')</Text>
              ) : (
                <Text style={styles.infoText}>
                  {' '}
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
            <View style={styles.infoRow}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.text}
              />
              <Text style={styles.infoText}>
                {content.description.replace(/\\n/g, '\n\n')}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeArea: {
    ...StyleSheet.absoluteFillObject
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    width: '80%',
    maxHeight: '90%'
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text
  },
  infoRow: {
    marginTop: spacing.medium,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  infoText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    paddingHorizontal: spacing.medium,
    textAlign: 'justify',
    lineHeight: 16
  },
  exploreButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    alignItems: 'center',
    marginTop: spacing.large
  },
  exploreButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  closeButton: {
    padding: spacing.xsmall
  },
  sectionTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.small
  },
  sectionDecoration: {
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  }
});
