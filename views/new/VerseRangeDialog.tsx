import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { MilestoneValue } from './MilestoneMarker';

export interface VerseRangeDialogProps {
  /** Whether the dialog is visible */
  isOpen: boolean;
  /** Called when visibility changes */
  onOpenChange: (open: boolean) => void;
  /** Total verses available for this chapter */
  totalVerses: number;
  /** Current milestone value (for initial selection) */
  currentValue: MilestoneValue;
  /** Position index for the milestone being edited */
  positionIndex: number;
  /** Called when user confirms selection */
  onConfirm: (positionIndex: number, value: MilestoneValue) => void;
}

/**
 * Dialog for selecting verse range milestones.
 * Shows all available verses as selectable tags.
 * Allows selecting single verse or range.
 */
export const VerseRangeDialog: React.FC<VerseRangeDialogProps> = ({
  isOpen,
  onOpenChange,
  totalVerses,
  currentValue,
  positionIndex,
  onConfirm
}) => {
  const { t } = useLocalization();

  // Track selected verses
  const [selectedVerses, setSelectedVerses] = React.useState<Set<number>>(
    () => {
      const set = new Set<number>();
      if (currentValue !== null) {
        if (typeof currentValue === 'number') {
          set.add(currentValue);
        } else {
          // Range: add all verses in range
          const [start, end] = currentValue;
          for (let i = start; i <= end; i++) {
            set.add(i);
          }
        }
      }
      return set;
    }
  );

  // Reset selection when dialog opens with new value
  React.useEffect(() => {
    if (isOpen) {
      const set = new Set<number>();
      if (currentValue !== null) {
        if (typeof currentValue === 'number') {
          set.add(currentValue);
        } else {
          const [start, end] = currentValue;
          for (let i = start; i <= end; i++) {
            set.add(i);
          }
        }
      }
      setSelectedVerses(set);
    }
  }, [isOpen, currentValue]);

  const handleVerseToggle = (verse: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedVerses((prev) => {
      const next = new Set(prev);
      if (next.has(verse)) {
        next.delete(verse);
      } else {
        next.add(verse);
      }
      return next;
    });
  };

  const handleClear = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedVerses(new Set());
  };

  const handleConfirm = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (selectedVerses.size === 0) {
      // Clear the milestone
      onConfirm(positionIndex, null);
    } else if (selectedVerses.size === 1) {
      // Single verse
      const verse = Array.from(selectedVerses)[0]!;
      onConfirm(positionIndex, verse);
    } else {
      // Range: use min and max
      const verses = Array.from(selectedVerses).sort((a, b) => a - b);
      const start = verses[0]!;
      const end = verses[verses.length - 1]!;
      onConfirm(positionIndex, [start, end]);
    }
    onOpenChange(false);
  };

  // Generate verse numbers
  const verses = React.useMemo(() => {
    return Array.from({ length: totalVerses }, (_, i) => i + 1);
  }, [totalVerses]);

  // Calculate selection summary
  const selectionSummary = React.useMemo(() => {
    if (selectedVerses.size === 0) return t('noSelection');
    if (selectedVerses.size === 1) {
      const verse = Array.from(selectedVerses)[0];
      return `${t('verse')} ${verse}`;
    }
    const sorted = Array.from(selectedVerses).sort((a, b) => a - b);
    return `${t('verses')} ${sorted[0]}-${sorted[sorted.length - 1]}`;
  }, [selectedVerses, t]);

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} snapPoints={['70%']}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('selectVerses')}</DrawerTitle>
          <DrawerDescription>{selectionSummary}</DrawerDescription>
        </DrawerHeader>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row flex-wrap gap-2">
            {verses.map((verse) => {
              const isSelected = selectedVerses.has(verse);
              return (
                <Pressable
                  key={verse}
                  onPress={() => handleVerseToggle(verse)}
                  className={cn(
                    'min-w-[44px] items-center justify-center rounded-lg px-3 py-2',
                    isSelected
                      ? 'bg-primary'
                      : 'border border-border bg-background'
                  )}
                >
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      isSelected
                        ? 'text-primary-foreground'
                        : 'text-foreground'
                    )}
                  >
                    {verse}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <DrawerFooter>
          <View className="flex-row gap-3">
            <DrawerClose className="flex-1">
              <Text>{t('cancel')}</Text>
            </DrawerClose>
            <Button
              variant="outline"
              className="flex-1"
              onPress={handleClear}
              disabled={selectedVerses.size === 0}
            >
              <Text>{t('clear')}</Text>
            </Button>
            <Button className="flex-1" onPress={handleConfirm}>
              <Text className="text-primary-foreground">{t('confirm')}</Text>
            </Button>
          </View>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

