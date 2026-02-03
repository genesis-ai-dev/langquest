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
  verseCount
}: VerseAssignerProps) {
  const [selectedFrom, setSelectedFrom] = React.useState<number | undefined>(
    initialFrom
  );
  const [selectedTo, setSelectedTo] = React.useState<number | undefined>(
    initialTo
  );

  // Track if selection came from an existing label (to prevent range editing)
  const [isExistingSelected, setIsExistingSelected] = React.useState(false);

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

    // Build a set of verses covered by existing labels
    const coveredByExisting = new Set<number>();
    for (const label of existingLabels) {
      for (let v = label.from; v <= label.to; v++) {
        coveredByExisting.add(v);
      }
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
      className={`rounded-xl border border-border bg-card p-4 ${className}`}
    >
      {/* Unified verse list */}
      <ScrollViewComponent
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
        contentContainerClassName="gap-2 px-1"
      >
        {unifiedList.map((item) => {
          if (item.type === 'existing') {
            // Existing label - render as a pill
            const isSelected =
              selectedFrom === item.from && selectedTo === item.to;
            const labelText =
              item.from === item.to
                ? `${item.from}`
                : `${item.from} - ${item.to}`;
            // Disable existing labels when user is selecting a new range
            const isDisabled =
              selectedFrom !== undefined && !isExistingSelected;

            return (
              <Pressable
                key={`existing-${item.from}-${item.to}`}
                onPress={() => handleExistingPress(item)}
                disabled={isDisabled}
                className={`h-10 items-center justify-center rounded-full px-3 ${
                  isSelected
                    ? 'bg-primary'
                    : isDisabled
                      ? 'bg-muted/30'
                      : 'border border-primary/30 bg-primary/5'
                } ${!isDisabled ? 'active:scale-95' : ''}`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isSelected
                      ? 'text-primary-foreground'
                      : isDisabled
                        ? 'text-muted-foreground/40'
                        : 'text-primary'
                  }`}
                >
                  {labelText}
                </Text>
              </Pressable>
            );
          } else {
            // Available verse - render as circle
            const verse = item.verse;
            const isSelectedFrom = verse === selectedFrom;
            const isSelectedTo = verse === selectedTo;
            const isSelected = isSelectedFrom || isSelectedTo;
            const selectable = isVerseSelectable(verse);

            return (
              <Pressable
                key={`available-${verse}`}
                onPress={() => handleAvailablePress(verse)}
                disabled={!selectable}
                className={`h-10 w-10 items-center justify-center rounded-full ${
                  isSelected
                    ? 'bg-primary'
                    : selectable
                      ? 'border border-primary/30 bg-primary/5'
                      : 'bg-muted/30'
                } ${selectable ? 'active:scale-95' : ''}`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isSelected
                      ? 'text-primary-foreground'
                      : selectable
                        ? 'text-primary'
                        : 'text-muted-foreground/40'
                  }`}
                >
                  {verse}
                </Text>
              </Pressable>
            );
          }
        })}
      </ScrollViewComponent>

      {/* Selected inputs */}
      <View className="mb-4 flex-row items-center justify-center gap-3">
        {/* From input */}
        <Pressable
          onPress={selectedFrom !== undefined ? handleClear : undefined}
          className={`h-12 w-20 flex-row items-center justify-center rounded-lg border ${
            selectedFrom !== undefined
              ? 'border-primary bg-primary/10'
              : 'border-dashed border-muted-foreground/30 bg-muted/30'
          }`}
        >
          {selectedFrom !== undefined ? (
            <>
              <Text className="text-lg font-semibold text-primary">
                {selectedFrom}
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
          className={`h-12 w-20 flex-row items-center justify-center rounded-lg border ${
            selectedTo !== undefined
              ? 'border-primary bg-primary/10'
              : selectedFrom !== undefined
                ? 'border-dashed border-muted-foreground/30 bg-muted/30'
                : 'border-dashed border-muted-foreground/20 bg-muted/20 opacity-50'
          }`}
        >
          {selectedTo !== undefined ? (
            <>
              <Text className="text-lg font-semibold text-primary">
                {selectedTo}
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
              <Text className="text-destructive-foreground">Remove Label</Text>
            </Button>
          )
        )}
      </View>
    </View>
  );
}
