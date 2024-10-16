import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, spacing, borderRadius } from '@/styles/theme';
import { Quest } from '@/types/quest';
import { useRouter } from 'expo-router';

interface QuestDetailsProps {
  quest: Quest;
  onClose: () => void;
}

export const QuestDetails: React.FC<QuestDetailsProps> = ({ quest, onClose}) => {
    const router = useRouter();
  
    const handleStartQuest = () => {
      router.push({
        pathname: "/assets",
        params: { questId: quest.id, questName: quest.title }
      });
      onClose();
    };
    
  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.closeArea} onPress={onClose} />
      <View style={styles.modal}>
        <Text style={styles.title}>{quest.title}</Text>
        <View style={styles.infoRow}>
          <Ionicons name="bookmark-outline" size={20} color={colors.text} />
          <Text style={styles.infoText}>Difficulty: {quest.difficulty}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={20} color={colors.text} />
          <Text style={styles.infoText}>Status: {quest.status}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="pricetag-outline" size={20} color={colors.text} />
          <Text style={styles.infoText}>Tags: {quest.tags.join(', ')}</Text>
        </View>
        <Text style={styles.description}>{quest.description}</Text>
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
  description: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginBottom: spacing.large,
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