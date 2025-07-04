import type { project } from '@/db/drizzleSchema';
import { useLanguageNames } from '@/hooks/db/useLanguages';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { default as React } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Match the type from projectService
// type ProjectWithRelations = typeof project.$inferSelect & {
//   source_language: typeof language.$inferSelect;
//   target_language: typeof language.$inferSelect;
// };

type Project = typeof project.$inferSelect;

interface ProjectDetailsProps {
  project: Project;
  onClose: () => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  project,
  onClose
}) => {
  const { languages } = useLanguageNames([
    project.source_language_id,
    project.target_language_id
  ]);

  const sourceLanguage = languages?.find(
    (language) => language.id === project.source_language_id
  );
  const targetLanguage = languages?.find(
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
            {sourceLanguage?.native_name || sourceLanguage?.english_name} →
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
