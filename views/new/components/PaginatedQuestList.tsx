import type { DraftQuest } from '@/store/localStore';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface QuestItemProps {
  quest: DraftQuest;
  index: number;
  onEdit: (quest: DraftQuest) => void;
  onDelete: (questId: string) => void;
}

const QuestItem: React.FC<QuestItemProps> = ({
  quest,
  index,
  onEdit,
  onDelete
}) => {
  return (
    <View style={styles.questItem}>
      <View style={styles.questItemContent}>
        <View style={styles.questHeader}>
          <Text style={styles.questNumber}>#{index + 1}</Text>
          <Text style={styles.questName}>{quest.name}</Text>
        </View>
        {quest.description && (
          <Text style={styles.questDescription}>{quest.description}</Text>
        )}
      </View>
      <View style={styles.questActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onEdit(quest)}
        >
          <Ionicons name="create-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onDelete(quest.id)}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface PaginatedQuestListProps {
  quests: DraftQuest[];
  onEditQuest: (quest: DraftQuest) => void;
  onDeleteQuest: (questId: string) => void;
  emptyMessage?: string;
}

export const PaginatedQuestList: React.FC<PaginatedQuestListProps> = ({
  quests,
  onEditQuest,
  onDeleteQuest,
  emptyMessage = 'No quests added yet. Add your first quest to get started.'
}) => {
  const renderItem = ({ item, index }: { item: DraftQuest; index: number }) => (
    <QuestItem
      quest={item}
      index={index}
      onEdit={onEditQuest}
      onDelete={onDeleteQuest}
    />
  );

  const keyExtractor = (item: DraftQuest) => item.id;

  const estimatedItemSize = useMemo(() => {
    // Estimate based on typical quest item height
    return 80;
  }, []);

  if (quests.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      <FlashList
        data={quests}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={estimatedItemSize}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.listContent}
        // Optimize for performance with many items
        removeClippedSubviews={true}
        getItemType={() => 'quest'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
    maxHeight: 400, // Limit height so it doesn't take over the whole screen
    marginTop: spacing.small
  },
  listContent: {
    paddingBottom: spacing.medium
  },
  questItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.small,
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  questItemContent: {
    flex: 1,
    marginRight: spacing.small
  },
  questHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xsmall
  },
  questNumber: {
    fontSize: fontSizes.small,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.small,
    paddingVertical: 2,
    borderRadius: borderRadius.small,
    marginRight: spacing.small,
    minWidth: 32,
    textAlign: 'center'
  },
  questName: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    flex: 1
  },
  questDescription: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xsmall,
    lineHeight: 18
  },
  questActions: {
    flexDirection: 'row',
    gap: spacing.xsmall
  },
  actionButton: {
    padding: spacing.small,
    borderRadius: borderRadius.small,
    borderWidth: 1,
    borderColor: colors.inputBackground,
    backgroundColor: colors.background
  },
  emptyContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.large,
    alignItems: 'center',
    marginTop: spacing.small
  },
  emptyText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20
  }
});
