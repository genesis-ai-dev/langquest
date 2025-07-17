import { QuestCard } from '@/components/QuestCard';
import QuestInProgress from '@/components/QuestInProgress';
import type { BibleReference } from '@/constants/bibleStructure';
import { BIBLE_BOOKS, formatBibleReference } from '@/constants/bibleStructure';
import type { Project } from '@/database_services/projectService';
import type { Quest } from '@/database_services/questService';
import type { Tag } from '@/database_services/tagService';
import { isProjectUnpublished } from '@/features/bible-recording/NewBibleProjectModal';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Helper function to detect if this is a Bible translation project
const isBibleTranslationProject = (project: Project, quest: Quest): boolean => {
  // Check if project name contains "Bible" or "Translation"
  const projectNameIndicator =
    project.name?.toLowerCase().includes('bible') ||
    project.name?.toLowerCase().includes('translation') ||
    false;

  // Check if quest name matches Bible book pattern (Genesis 1:1, Matthew 5:3, etc.)
  const questNameIndicator = BIBLE_BOOKS.some((book) =>
    quest.name.toLowerCase().includes(book.name.toLowerCase())
  );

  // Check if quest description mentions Bible references
  const descriptionIndicator = quest.description
    ? quest.description.includes(':') &&
      Boolean(/\d+:\d+/.exec(quest.description))
    : false;

  return projectNameIndicator || questNameIndicator || descriptionIndicator;
};

// Helper function to extract Bible reference from quest name/description
const extractBibleReference = (quest: Quest): BibleReference | null => {
  // Try to extract from quest name first (e.g., "Genesis 1:1")
  const nameMatch = /(\w+)\s+(\d+):(\d+)/.exec(quest.name);
  if (nameMatch && nameMatch.length >= 4) {
    const [, bookName, chapter, verse] = nameMatch;
    if (bookName && chapter && verse) {
      const book = BIBLE_BOOKS.find(
        (b) => b.name.toLowerCase() === bookName.toLowerCase()
      );
      if (book) {
        return {
          book: book.id,
          chapter: parseInt(chapter, 10),
          verse: parseInt(verse, 10)
        };
      }
    }
  }

  // Try to extract from description
  if (quest.description) {
    const descMatch = /(\w+)\s+(\d+):(\d+)/.exec(quest.description);
    if (descMatch && descMatch.length >= 4) {
      const [, bookName, chapter, verse] = descMatch;
      if (bookName && chapter && verse) {
        const book = BIBLE_BOOKS.find(
          (b) => b.name.toLowerCase() === bookName.toLowerCase()
        );
        if (book) {
          return {
            book: book.id,
            chapter: parseInt(chapter, 10),
            verse: parseInt(verse, 10)
          };
        }
      }
    }
  }

  return null;
};

// Bible Quest Card Component
const BibleQuestCard: React.FC<{
  quest: Quest & { tags: { tag: Tag }[] };
  project: Project;
  reference: BibleReference;
  isUnpublished: boolean;
  onPress: () => void;
}> = ({ quest, project: _project, reference, isUnpublished, onPress }) => {
  const book = BIBLE_BOOKS.find((b) => b.id === reference.book);
  const chapterTitle = book ? `${book.name} ${reference.chapter}` : quest.name;

  return (
    <TouchableOpacity onPress={onPress}>
      <View
        style={[styles.bibleQuestCard, isUnpublished && styles.unpublishedCard]}
      >
        <View style={styles.bibleQuestHeader}>
          <View style={styles.bibleQuestTitleSection}>
            <Text
              style={[
                styles.bibleQuestTitle,
                isUnpublished && styles.unpublishedText
              ]}
            >
              {chapterTitle}
            </Text>

            {/* Unpublished badge */}
            {isUnpublished && (
              <View style={styles.unpublishedBadge}>
                <Text style={styles.unpublishedBadgeText}>LOCAL</Text>
              </View>
            )}

            {/* Progress indicator */}
            <View style={styles.progressContainer}>
              <Ionicons name="mic" size={16} color={colors.textSecondary} />
              <Text style={styles.progressText}>In Progress</Text>
            </View>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        </View>

        <Text
          style={[
            styles.bibleQuestReference,
            isUnpublished && styles.unpublishedText
          ]}
        >
          Starting at {formatBibleReference(reference)}
        </Text>

        {quest.description && (
          <Text
            style={[
              styles.bibleQuestDescription,
              isUnpublished && styles.unpublishedText
            ]}
          >
            {quest.description}
          </Text>
        )}

        {/* Status indicator for unpublished projects */}
        {isUnpublished && (
          <Text style={styles.unpublishedStatus}>
            📱 Stored locally - will sync when published
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Memoized quest item component for better performance
export const QuestItem = React.memo(
  ({
    quest,
    project,
    onPress
  }: {
    quest: Quest & { tags: { tag: Tag }[] };
    project: Project | null;
    onPress: (quest: Quest) => void;
  }) => {
    const [showQuestInProgress, setShowQuestInProgress] = useState(false);
    const [isUnpublished, setIsUnpublished] = useState(false);

    // Check if project is unpublished
    useEffect(() => {
      const checkPublishStatus = async () => {
        if (project) {
          const unpublished = await isProjectUnpublished(project.id);
          setIsUnpublished(unpublished);
        }
      };
      void checkPublishStatus();
    }, [project]);

    const handlePress = useCallback(() => {
      // For Bible translation projects, open QuestInProgress instead of regular quest view
      if (project && isBibleTranslationProject(project, quest)) {
        setShowQuestInProgress(true);
      } else {
        onPress(quest);
      }
    }, [quest, project, onPress]);

    const handleCloseQuestInProgress = useCallback(() => {
      setShowQuestInProgress(false);
    }, []);

    const handleSaveAssets = useCallback(
      (
        assets: {
          id: string;
          position: number;
          title: string;
          segmentIds: string[];
        }[]
      ) => {
        console.log('Saving assets for quest:', quest.id, assets);
        // TODO: Implement asset creation logic
        setShowQuestInProgress(false);
      },
      [quest.id]
    );

    if (!project) return null;

    // Check if this is a Bible translation project
    const isBibleProject = isBibleTranslationProject(project, quest);
    const bibleReference = extractBibleReference(quest);

    // Render Bible-specific quest card
    if (isBibleProject && bibleReference) {
      return (
        <>
          <BibleQuestCard
            quest={quest}
            project={project}
            reference={bibleReference}
            isUnpublished={isUnpublished}
            onPress={handlePress}
          />

          {/* Quest In Progress Modal */}
          {showQuestInProgress && (
            <QuestInProgress
              isVisible={showQuestInProgress}
              onClose={handleCloseQuestInProgress}
              questId={quest.id}
              questName={quest.name}
              projectId={quest.project_id}
              initialReference={bibleReference}
              onSaveAssets={handleSaveAssets}
            />
          )}
        </>
      );
    }

    // Render regular quest card for non-Bible projects
    return (
      <TouchableOpacity onPress={handlePress}>
        <QuestCard quest={quest} project={project} />
      </TouchableOpacity>
    );
  }
);

const styles = StyleSheet.create({
  bibleQuestCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary
  },
  unpublishedCard: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    backgroundColor: colors.backgroundSecondary,
    opacity: 0.9
  },
  bibleQuestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.small
  },
  bibleQuestTitleSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.small
  },
  bibleQuestTitle: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text
  },
  unpublishedText: {
    fontStyle: 'italic',
    color: colors.textSecondary
  },
  unpublishedBadge: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  unpublishedBadgeText: {
    color: colors.buttonText,
    fontSize: fontSizes.xsmall,
    fontWeight: 'bold'
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xsmall,
    borderRadius: borderRadius.small
  },
  progressText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  bibleQuestReference: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    marginBottom: spacing.small
  },
  bibleQuestDescription: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    lineHeight: 20
  },
  unpublishedStatus: {
    fontSize: fontSizes.small,
    color: colors.primary,
    marginTop: spacing.small,
    fontStyle: 'italic'
  }
});
