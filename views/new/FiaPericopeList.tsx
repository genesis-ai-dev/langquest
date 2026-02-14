/**
 * Displays FIA pericopes for a selected book within a project.
 * Modeled on BibleChapterList: creates pericope quests on-demand and navigates
 * to the same recording view used by Bible chapters.
 */

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import type { FiaBook, FiaPericope } from '@/hooks/useFiaBooks';
import { useFiaPericopeCreation } from '@/hooks/useFiaPericopeCreation';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useProjectById } from '@/hooks/db/useProjects';
import { BOOK_ICON_MAP } from '@/utils/BOOK_GRAPHICS';
import { cn, useThemeColor } from '@/utils/styleUtils';
import { LegendList } from '@legendapp/list';
import { BookOpenIcon, PlusCircleIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Image, View } from 'react-native';

// Same mapping as FiaBookList
const FIA_TO_BIBLE_BOOK_ID: Record<string, string> = {
  mrk: 'mar',
  php: 'phi',
  jol: 'joe',
  nam: 'nah',
};

function getFiaBookIcon(fiaBookId: string) {
  if (BOOK_ICON_MAP[fiaBookId]) return BOOK_ICON_MAP[fiaBookId];
  const mappedId = FIA_TO_BIBLE_BOOK_ID[fiaBookId];
  if (mappedId && BOOK_ICON_MAP[mappedId]) return BOOK_ICON_MAP[mappedId];
  return null;
}

interface FiaPericopeListProps {
  projectId: string;
  book: FiaBook;
  onCloudLoadingChange?: (isLoading: boolean) => void;
}

export function FiaPericopeList({
  projectId,
  book
}: FiaPericopeListProps) {
  const { currentUser } = useAuth();
  const { goToQuest } = useAppNavigation();
  const { createPericope, isCreating } = useFiaPericopeCreation();
  const [creatingPericopeId, setCreatingPericopeId] = React.useState<
    string | null
  >(null);

  const { project } = useProjectById(projectId);
  const isPrivate = project?.private ?? false;
  const primaryColor = useThemeColor('primary');
  const iconSource = getFiaBookIcon(book.id);

  const { membership } = useUserPermissions(
    projectId,
    'open_project',
    isPrivate
  );
  const isMember = membership === 'member' || membership === 'owner';
  const canCreateNew = isMember;

  const handlePericopePress = async (pericope: FiaPericope) => {
    if (!currentUser?.id || isCreating) return;

    setCreatingPericopeId(pericope.id);
    try {
      const result = await createPericope({
        projectId,
        bookId: book.id,
        bookTitle: book.title,
        pericopeId: pericope.id,
        verseRange: pericope.verseRange,
        totalPericopesInBook: book.pericopes.length
      });

      // Navigate to the quest - pass project data for correct asset view routing
      goToQuest({
        id: result.questId,
        project_id: projectId,
        name: result.questName,
        projectData: project as Record<string, unknown>,
      });
    } catch (error) {
      console.error('Failed to create pericope quest:', error);
    } finally {
      setCreatingPericopeId(null);
    }
  };

  const renderPericope = (pericope: FiaPericope, index: number) => {
    const isCreatingThis = creatingPericopeId === pericope.id;

    return (
      <View
        key={pericope.id}
        className={cn(
          'w-full flex-col items-center gap-1 rounded-md border border-border py-3',
          canCreateNew ? 'bg-background' : 'bg-muted/50 opacity-40'
        )}
      >
        <Button
          variant="ghost"
          className="h-auto w-full flex-col items-center gap-1 p-2"
          onPress={() => handlePericopePress(pericope)}
          disabled={!canCreateNew || isCreating}
        >
          {isCreatingThis ? (
            <ActivityIndicator size="small" />
          ) : (
            <>
              <Text className="text-base font-bold">
                {pericope.verseRange}
              </Text>
              <Text className="text-xxs text-muted-foreground">
                p{index + 1}
              </Text>
            </>
          )}
        </Button>
      </View>
    );
  };

  return (
    <View className="flex-1">
      {/* Book header with icon */}
      <View className="mb-4 flex-row items-center gap-3 px-2">
        {iconSource ? (
          <Image
            source={iconSource}
            style={{ width: 48, height: 48, tintColor: primaryColor }}
            resizeMode="contain"
          />
        ) : (
          <Icon as={BookOpenIcon} size={32} className="text-primary" />
        )}
        <View>
          <Text variant="h4">{book.title}</Text>
          <Text className="text-sm text-muted-foreground">
            {book.pericopes.length} pericopes
          </Text>
        </View>
      </View>

      <LegendList
        data={book.pericopes}
        keyExtractor={(item) => item.id}
        estimatedItemSize={70}
        contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
        recycleItems
        renderItem={({ item, index }) => renderPericope(item, index)}
      />
    </View>
  );
}
