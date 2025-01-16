import { useProjectContext } from '@/contexts/ProjectContext';
import { quest, tag } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type QuestWithRelations = typeof quest.$inferSelect & {
  tags: (typeof tag.$inferSelect)[];
};

interface QuestDetailsProps {
  quest: QuestWithRelations;
  onClose: () => void;
}

export const QuestDetails: React.FC<QuestDetailsProps> = ({
  quest,
  onClose,
}) => {
  const { t } = useTranslation();
  const { goToQuest } = useProjectContext();

  const handleStartQuest = () => {
    goToQuest(quest);
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.closeArea} onPress={onClose} />
      <View style={styles.modal}>
        <Text style={styles.title}>{quest.name}</Text>

        {quest.description && (
          <Text style={styles.description}>{quest.description}</Text>
        )}

        {quest.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {quest.tags.map((tag, index) => {
              const [category, value] = tag.name.split(':');
              return (
                <View key={tag.id} style={styles.tagItem}>
                  <Text style={styles.tagCategory}>{category}:</Text>
                  <Text style={styles.tagValue}>{value}</Text>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={styles.startButton} onPress={handleStartQuest}>
          <Text style={styles.startButtonText}>{t('startQuest')}</Text>
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
  description: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginBottom: spacing.large,
  },
  tagsContainer: {
    marginBottom: spacing.large,
  },
  tagItem: {
    flexDirection: 'row',
    marginBottom: spacing.small,
  },
  tagCategory: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: 'bold',
    marginRight: spacing.small,
  },
  tagValue: {
    fontSize: fontSizes.medium,
    color: colors.text,
  },
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    alignItems: 'center',
    marginTop: spacing.large,
  },
  startButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
  },
});
