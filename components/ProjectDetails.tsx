import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, spacing, borderRadius } from '@/styles/theme';
import { project, language } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';

// Match the type from projectService
type ProjectWithRelations = typeof project.$inferSelect & {
  sourceLanguage: typeof language.$inferSelect;
  targetLanguage: typeof language.$inferSelect;
};

interface ProjectDetailsProps {
  project: ProjectWithRelations;
  onClose: () => void;
  onExplore: () => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ project, onClose, onExplore }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.closeArea} onPress={onClose} />
      <View style={styles.modal}>
        <Text style={styles.title}>{project.name}</Text>
        
        <View style={styles.infoRow}>
          <Ionicons name="language-outline" size={20} color={colors.text} />
          <Text style={styles.infoText}>
            {project.sourceLanguage.nativeName || project.sourceLanguage.englishName} → 
            {project.targetLanguage.nativeName || project.targetLanguage.englishName}
          </Text>
        </View>

        {project.description && (
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={20} color={colors.text} />
            <Text style={styles.infoText}>{project.description}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.exploreButton} onPress={onExplore}>
          <Text style={styles.exploreButtonText}>{t('explore')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeArea: {
    ...StyleSheet.absoluteFillObject,
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    width: '80%',
    maxHeight: '80%',
  },
  title: {
    fontSize: fontSizes.xlarge,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  infoText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginLeft: spacing.small,
  },
  exploreButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    alignItems: 'center',
    marginTop: spacing.large,
  },
  exploreButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
  },
});