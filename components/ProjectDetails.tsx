import type { language, project } from '@/db/drizzleSchema';
import {
  language as languageTable,
  project_language_link as pll
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { useHybridData } from '@/views/new/useHybridData';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';
import { default as React } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Project = typeof project.$inferSelect;
type Language = typeof language.$inferSelect;

interface ProjectDetailsProps {
  project: Project;
  onClose: () => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  project,
  onClose
}) => {
  // Fetch project source languages from project_language_link and single target from project
  const { data: sourceLanguages = [] } = useHybridData<Language>({
    dataType: 'project-source-languages',
    queryKeyParams: [project.id],
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          id: languageTable.id,
          native_name: languageTable.native_name,
          english_name: languageTable.english_name
        })
        .from(pll)
        .innerJoin(languageTable, eq(pll.language_id, languageTable.id))
        .where(
          and(eq(pll.project_id, project.id), eq(pll.language_type, 'source'))
        )
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
        columns: { id: true, native_name: true, english_name: true },
        where: eq(languageTable.id, project.target_language_id)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('language')
        .select('id, native_name, english_name')
        .eq('id', project.target_language_id)
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    }
  });

  const targetLanguage = targetLangArr[0];

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.closeArea} onPress={onClose} />
      <View style={styles.modal}>
        <Text style={styles.title}>{project.name}</Text>

        <View style={styles.infoRow}>
          <Ionicons name="language-outline" size={20} color={colors.text} />
          <Text style={styles.infoText}>
            {sourceLanguages.length
              ? sourceLanguages
                  .map((l) => l.native_name || l.english_name)
                  .filter(Boolean)
                  .join(', ')
              : '—'}{' '}
            → {targetLanguage?.native_name || targetLanguage?.english_name}
          </Text>
        </View>

        {project.description && (
          <View style={styles.infoRow}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.text}
            />
            <Text style={styles.infoText}>{project.description}</Text>
          </View>
        )}
      </View>
    </View>
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
    maxHeight: '80%'
  },
  title: {
    fontSize: fontSizes.xlarge,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  infoText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    paddingHorizontal: spacing.small
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
  }
});
