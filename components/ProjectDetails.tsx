import type { language, project } from '@/db/drizzleSchema';
import { language as languageTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { useHybridData } from '@/views/new/useHybridData';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, inArray } from 'drizzle-orm';
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
  const languageIds = [project.source_language_id, project.target_language_id];

  // Use useHybridData directly
  const { data: languages } = useHybridData<
    Pick<Language, 'id' | 'native_name' | 'english_name'>
  >({
    dataType: 'languages',
    queryKeyParams: languageIds,

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        columns: { id: true, native_name: true, english_name: true },
        where: and(
          eq(languageTable.active, true),
          inArray(languageTable.id, languageIds)
        )
      })
    ),

    // Cloud query
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('language')
        .select('id, native_name, english_name')
        .eq('active', true)
        .in('id', languageIds)
        .overrideTypes<
          { id: string; native_name: string; english_name: string }[]
        >();
      if (error) throw error;
      return data;
    }
  });

  const sourceLanguage = languages.find(
    (language) => language.id === project.source_language_id
  );
  const targetLanguage = languages.find(
    (language) => language.id === project.target_language_id
  );

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.closeArea} onPress={onClose} />
      <View style={styles.modal}>
        <Text style={styles.title}>{project.name}</Text>

        <View style={styles.infoRow}>
          <Ionicons name="language-outline" size={20} color={colors.text} />
          <Text style={styles.infoText}>
            {sourceLanguage?.native_name || sourceLanguage?.english_name} →{' '}
            {targetLanguage?.native_name || targetLanguage?.english_name}
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
