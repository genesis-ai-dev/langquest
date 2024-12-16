import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fontSizes, spacing, borderRadius } from '@/styles/theme';
import { quest, tag } from '@/db/drizzleSchema';
import { useRouter } from 'expo-router';

type QuestWithRelations = typeof quest.$inferSelect & {
  tags: (typeof tag.$inferSelect)[];
};

interface QuestDetailsProps {
  quest: QuestWithRelations;
  onClose: () => void;
}

export const QuestDetails: React.FC<QuestDetailsProps> = ({ quest, onClose }) => {
  const router = useRouter();
  
  const handleStartQuest = () => {
    router.push({
      pathname: "/assets",
      params: { quest_id: quest.id, questName: quest.name }
    });
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
          <Text style={styles.startButtonText}>Start Quest</Text>
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