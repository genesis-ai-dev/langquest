import { cn } from '@/utils/styleUtils';
import { XIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

export interface ExistingLabel {
  from: number;
  to: number;
}

// Unified list item type
type ListItem =
  | { type: 'available'; verse: number }
  | { type: 'existing'; from: number; to: number };

interface VerseAssignerProps {
  // Either provide availableVerses array OR from/to range (for backward compatibility)
  availableVerses?: number[];
  from?: number;
  to?: number;
  selectedFrom?: number;
  selectedTo?: number;
  onApply: (from: number, to: number) => void;
  onCancel: () => void;
  onRemove?: () => void; // Optional callback to remove labels from selected assets
  hasSelectedAssetsWithLabels?: boolean; // Whether selected assets have labels to remove
  className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ScrollViewComponent?: React.ComponentType<any>;
  // Optional function to limit the maximum "to" value based on selected "from"
  getMaxToForFrom?: (selectedFrom: number) => number;
  // Existing verse labels to display for quick selection
  existingLabels?: ExistingLabel[];
  // Total verse count for the chapter (to show all verses in unified list)
  verseCount?: number;
  /** Map a position number to a display label (e.g., "2:23"). Also used for chapter separators. */
  formatLabel?: (position: number) => string | null;
  /** Pericope verse sequence for detecting chapter boundaries between bubbles. */
  chapterSequence?: { chapter: number; verse: number }[];
}

export function VerseAssigner({
  availableVerses,
  from,
  to,
  selectedFrom: initialFrom,
  selectedTo: initialTo,
  onApply,
  onCancel,
  onRemove,
  hasSelectedAssetsWithLabels = false,
  className = '',
  ScrollViewComponent = ScrollView,
  getMaxToForFrom,
  existingLabels = [],
  verseCount,
  formatLabel,
  chapterSequence
}: VerseAssignerProps) {
  const [selectedFrom, setSelectedFrom] = React.useState<number | undefined>(
    initialFrom
  );
  const [selectedTo, setSelectedTo] = React.useState<number | undefined>(
    initialTo
  );

  // Track if selection came from an existing label (to prevent range editing)
  const [isExistingSelected, setIsExistingSelected] = React.useState(false);

  const usePill = !!formatLabel;

  const formatPosition = React.useCallback(
    (position: number) => formatLabel?.(position) ?? String(position),
    [formatLabel]
  );

  const formatRangeLabel = React.useCallback(
    (rangeFrom: number, rangeTo: number) => {
      if (rangeFrom === rangeTo) {
        return formatPosition(rangeFrom);
      }
      return `${formatPosition(rangeFrom)} - ${formatPosition(rangeTo)}`;
    },
    [formatPosition]
  );

  // Generate array of available numbers
  const availableSet = React.useMemo(() => {
    const set = new Set<number>();
    if (availableVerses && availableVerses.length > 0) {
      availableVerses.forEach((v) => set.add(v));
    } else if (from !== undefined && to !== undefined) {
      for (let i = from; i <= to; i++) {
        set.add(i);
      }
    }
    return set;
  }, [availableVerses, from, to]);

  // Determine total verse range
  const totalVerseCount = React.useMemo(() => {
    if (verseCount) return verseCount;
    // Calculate from available verses and existing labels
    let max = 0;
    availableSet.forEach((v) => {
      if (v > max) max = v;
    });
    existingLabels.forEach((label) => {
      if (label.to > max) max = label.to;
    });
    return max || to || 1;
  }, [verseCount, availableSet, existingLabels, to]);

  // Build unified list: interleave available verses with existing labels
  const unifiedList = React.useMemo(() => {
    const items: ListItem[] = [];
    const existingMap = new Map<number, ExistingLabel>(); // Maps 'from' to label

    // Index existing labels by their starting verse
    for (const label of existingLabels) {
      existingMap.set(label.from, label);
    }

    let verse = 1;
    while (verse <= totalVerseCount) {
      // Check if this verse starts an existing label
      const existingLabel = existingMap.get(verse);
      if (existingLabel) {
        items.push({
          type: 'existing',
          from: existingLabel.from,
          to: existingLabel.to
        });
        // Skip to after the label's range
        verse = existingLabel.to + 1;
      } else if (availableSet.has(verse)) {
        // Available verse (not part of any existing label)
        items.push({ type: 'available', verse });
        verse++;
      } else {
        // Verse is not available and not in existing label - skip it
        verse++;
      }
    }

    return items;
  }, [totalVerseCount, existingLabels, availableSet]);

  const getItemStartPosition = React.useCallback((item: ListItem) => {
    return item.type === 'existing' ? item.from : item.verse;
  }, []);

  // Calculate max "to" value when "from" is selected
  const maxTo: number = React.useMemo(() => {
    if (selectedFrom === undefined) {
      return totalVerseCount;
    }
    if (getMaxToForFrom) {
      return getMaxToForFrom(selectedFrom);
    }
    return totalVerseCount;
  }, [selectedFrom, getMaxToForFrom, totalVerseCount]);

  // Check if a verse is selectable for range selection
  const isVerseSelectable = React.useCallback(
    (verse: number) => {
      if (!availableSet.has(verse)) return false;

      // If nothing selected, all available are selectable
      if (selectedFrom === undefined) return true;

      // If existing label is selected, nothing else is selectable
      if (isExistingSelected) return false;

      // If only "from" selected, only verses >= selectedFrom and <= maxTo are selectable
      if (selectedTo === undefined) {
        return verse >= selectedFrom && verse <= maxTo;
      }

      // If both selected, nothing is selectable
      return false;
    },
    [selectedFrom, selectedTo, maxTo, availableSet, isExistingSelected]
  );

  const handleAvailablePress = (verse: number) => {
    if (!isVerseSelectable(verse)) return;

    if (selectedFrom === undefined) {
      // First selection
      setSelectedFrom(verse);
      setSelectedTo(undefined);
      setIsExistingSelected(false);
    } else if (selectedTo === undefined && !isExistingSelected) {
      // Second selection for range
      setSelectedTo(Math.min(verse, maxTo));
    }
  };

  const handleExistingPress = (label: ExistingLabel) => {
    // If already selected, deselect
    if (selectedFrom === label.from && selectedTo === label.to) {
      setSelectedFrom(undefined);
      setSelectedTo(undefined);
      setIsExistingSelected(false);
    } else {
      // Select this existing label
      setSelectedFrom(label.from);
      setSelectedTo(label.to);
      setIsExistingSelected(true);
    }
  };

  const handleClear = () => {
    setSelectedFrom(undefined);
    setSelectedTo(undefined);
    setIsExistingSelected(false);
  };

  const handleApply = () => {
    if (selectedFrom !== undefined && selectedTo !== undefined) {
      onApply(selectedFrom, selectedTo);
    } else if (selectedFrom !== undefined) {
      onApply(selectedFrom, selectedFrom);
    }
  };

  const canApply = selectedFrom !== undefined;

  return (
    <View
      className={cn(
        'rounded-xl border border-border bg-card p-4',
        className
      )}
    >
      {/* Unified verse list */}
      <ScrollViewComponent
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
        contentContainerClassName="gap-2 px-1"
      >
        {unifiedList.map((item, idx) => {
          const startPosition = getItemStartPosition(item);
          let showChapterSep = false;
          if (chapterSequence && idx > 0) {
            const prevStart = getItemStartPosition(unifiedList[idx - 1]!);
            const prevEntry = chapterSequence[prevStart - 1];
            const currEntry = chapterSequence[startPosition - 1];
            if (
              prevEntry &&
              currEntry &&
              prevEntry.chapter !== currEntry.chapter
            ) {
              showChapterSep = true;
            }
          }

          if (item.type === 'existing') {
            // Existing label - render as a pill
            const isSelected =
              selectedFrom === item.from && selectedTo === item.to;
            const labelText = formatRangeLabel(item.from, item.to);
            // Disable existing labels when user is selecting a new range
            const isDisabled =
              selectedFrom !== undefined && !isExistingSelected;

            return (
              <React.Fragment key={`existing-${item.from}-${item.to}`}>
                {showChapterSep && <View className="mx-1 h-10 w-px bg-border" />}
                <Pressable
                  onPress={() => handleExistingPress(item)}
                  disabled={isDisabled}
                  className={cn(
                    'h-10 items-center justify-center px-3 active:scale-95',
                    usePill ? 'rounded-lg' : 'rounded-full',
                    isSelected
                      ? 'bg-primary'
                      : isDisabled
                        ? 'bg-muted/30'
                        : 'border border-primary/30 bg-primary/5'
                  )}
                >
                  <Text
                    className={cn(
                      'font-medium',
                      usePill ? 'text-xs' : 'text-sm',
                      isSelected
                        ? 'text-primary-foreground'
                        : isDisabled
                          ? 'text-muted-foreground/40'
                          : 'text-primary'
                    )}
                  >
                    {labelText}
                  </Text>
                </Pressable>
              </React.Fragment>
            );
          }

          // Available verse - render as circle (or pill for FIA labels)
          const verse = item.verse;
          const isSelectedFrom = verse === selectedFrom;
          const isSelectedTo = verse === selectedTo;
          const isSelected = isSelectedFrom || isSelectedTo;
          const selectable = isVerseSelectable(verse);
          const label = formatPosition(verse);

          return (
            <React.Fragment key={`available-${verse}`}>
              {showChapterSep && <View className="mx-1 h-10 w-px bg-border" />}
              <Pressable
                onPress={() => handleAvailablePress(verse)}
                disabled={!selectable}
                className={cn(
                  'h-10 items-center justify-center active:scale-95',
                  usePill ? 'rounded-lg px-2.5' : 'w-10 rounded-full',
                  isSelected
                    ? 'bg-primary'
                    : selectable
                      ? 'border border-primary/30 bg-primary/5'
                      : 'bg-muted/30'
                )}
              >
                <Text
                  className={cn(
                    'font-medium',
                    usePill ? 'text-xs' : 'text-sm',
                    isSelected
                      ? 'text-primary-foreground'
                      : selectable
                        ? 'text-primary'
                        : 'text-muted-foreground/40'
                  )}
                >
                  {label}
                </Text>
              </Pressable>
            </React.Fragment>
          );
        })}
      </ScrollViewComponent>

      {/* Selected inputs */}
      <View className="mb-4 flex-row items-center justify-center gap-3">
        {/* From input */}
        <Pressable
          onPress={selectedFrom !== undefined ? handleClear : undefined}
          className={cn(
            'h-12 min-w-20 flex-row items-center justify-center rounded-lg border px-3',
            selectedFrom !== undefined
              ? 'border-primary bg-primary/10'
              : 'border-dashed border-muted-foreground/30 bg-muted/30'
          )}
        >
          {selectedFrom !== undefined ? (
            <>
              <Text className="text-lg font-semibold text-primary">
                {formatPosition(selectedFrom)}
              </Text>
              <Icon as={XIcon} size={14} className="ml-1 text-primary/60" />
            </>
          ) : (
            <Text className="text-sm text-muted-foreground/50">From</Text>
          )}
        </Pressable>

        <Text className="text-muted-foreground">—</Text>

        {/* To input */}
        <Pressable
          onPress={selectedTo !== undefined ? handleClear : undefined}
          disabled={selectedFrom === undefined}
          className={cn(
            'h-12 min-w-20 flex-row items-center justify-center rounded-lg border px-3',
            selectedTo !== undefined
              ? 'border-primary bg-primary/10'
              : selectedFrom !== undefined
                ? 'border-dashed border-muted-foreground/30 bg-muted/30'
                : 'border-dashed border-muted-foreground/20 bg-muted/20 opacity-50'
          )}
        >
          {selectedTo !== undefined ? (
            <>
              <Text className="text-lg font-semibold text-primary">
                {formatPosition(selectedTo)}
              </Text>
              <Icon as={XIcon} size={14} className="ml-1 text-primary/60" />
            </>
          ) : (
            <Text className="text-sm text-muted-foreground/50">To</Text>
          )}
        </Pressable>
      </View>

      {/* Action buttons */}
      <View className="flex-row gap-3">
        <Button variant="outline" className="flex-1" onPress={onCancel}>
          <Text>Cancel</Text>
        </Button>
        {selectedFrom !== undefined ? (
          // Show Apply when verse is selected
          <Button
            variant="default"
            className="flex-1"
            onPress={handleApply}
            disabled={!canApply}
          >
            <Text className="text-primary-foreground">Apply</Text>
          </Button>
        ) : (
          // Show Remove when no selection but assets have labels
          onRemove &&
          hasSelectedAssetsWithLabels && (
            <Button variant="destructive" className="flex-1" onPress={onRemove}>
              <Text className="text-destructive-foreground">Remove</Text>
            </Button>
          )
        )}
      </View>
    </View>
  );
}
