import type { Quest } from '@/database_services/questService';
import { useTagsByQuestId } from '@/hooks/db/useTags';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface QuestDetailsProps {
  quest: Quest;
  onClose: () => void;
}

export const QuestDetails: React.FC<QuestDetailsProps> = ({
  quest,
  onClose
}) => {
  const { tags } = useTagsByQuestId(quest.id);

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.closeArea} onPress={onClose} />
      <View style={styles.modal}>
        <Text style={styles.title}>{quest.name}</Text>

        {quest.description && (
          <Text style={styles.description}>{quest.description}</Text>
        )}

        {tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {tags.map((tag) => {
              return (
                <View key={tag.tag.id} style={styles.tagItem}>
                  <Text style={styles.tagCategory}>{tag.tag.key}:</Text>
                  <Text style={styles.tagValue}>{tag.tag.value}</Text>
                </View>
              );
            })}
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
  description: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginBottom: spacing.large
  },
  tagsContainer: {
    marginBottom: spacing.large
  },
  tagItem: {
    flexDirection: 'row',
    marginBottom: spacing.small
  },
  tagCategory: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: 'bold',
    marginRight: spacing.small
  },
  tagValue: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    alignItems: 'center',
    marginTop: spacing.large
  },
  startButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  }
});
