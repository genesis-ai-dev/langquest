import { XIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface VerseRangeSelectorProps {
  // Either provide availableVerses array OR from/to range (for backward compatibility)
  availableVerses?: number[];
  from?: number;
  to?: number;
  selectedFrom?: number;
  selectedTo?: number;
  onApply: (from: number, to: number) => void;
  onCancel: () => void;
  className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ScrollViewComponent?: React.ComponentType<any>;
  // Optional function to limit the maximum "to" value based on selected "from"
  getMaxToForFrom?: (selectedFrom: number) => number;
  /** Map a position number to a display label (e.g., "2:23"). Also used for chapter separators. */
  formatLabel?: (position: number) => string | null;
  /** Pericope verse sequence for detecting chapter boundaries between bubbles. */
  chapterSequence?: { chapter: number; verse: number }[];
}

export function VerseRangeSelector({
  availableVerses,
  from,
  to,
  selectedFrom: initialFrom,
  selectedTo: initialTo,
  onApply,
  onCancel,
  className = '',
  ScrollViewComponent = ScrollView,
  getMaxToForFrom,
  formatLabel,
  chapterSequence
}: VerseRangeSelectorProps) {
  const [selectedFrom, setSelectedFrom] = React.useState<number | undefined>(
    initialFrom
  );
  const [selectedTo, setSelectedTo] = React.useState<number | undefined>(
    initialTo
  );

  // Generate array of numbers - use availableVerses if provided, otherwise generate from/to range
  const allNumbers = React.useMemo(() => {
    if (availableVerses && availableVerses.length > 0) {
      return availableVerses;
    }
    // Fallback to from/to range for backward compatibility
    if (from !== undefined && to !== undefined) {
      const numbers: number[] = [];
      for (let i = from; i <= to; i++) {
        numbers.push(i);
      }
      return numbers;
    }
    return [];
  }, [availableVerses, from, to]);

  // Calculate max "to" value when "from" is selected
  const maxTo: number = React.useMemo(() => {
    if (selectedFrom === undefined) {
      return allNumbers.length > 0
        ? allNumbers[allNumbers.length - 1]!
        : to || 1;
    }
    if (getMaxToForFrom) {
      return getMaxToForFrom(selectedFrom);
    }
    // If no getMaxToForFrom function, allow up to the last available verse
    return allNumbers.length > 0 ? allNumbers[allNumbers.length - 1]! : to || 1;
  }, [selectedFrom, getMaxToForFrom, allNumbers, to]);

  // Check if a number is selectable based on current selection state
  const isNumberSelectable = React.useCallback(
    (num: number) => {
      // Number must be in the available numbers list
      if (!allNumbers.includes(num)) {
        return false;
      }

      // If nothing selected, all available numbers are selectable
      if (selectedFrom === undefined) {
        return true;
      }
      // If only "from" selected, only numbers >= selectedFrom and <= maxTo are selectable
      if (selectedTo === undefined) {
        return num >= selectedFrom && num <= maxTo && allNumbers.includes(num);
      }
      // If both selected, nothing is selectable (user must clear first)
      return false;
    },
    [selectedFrom, selectedTo, maxTo, allNumbers]
  );

  const handleNumberPress = (num: number) => {
    if (!isNumberSelectable(num)) return;

    if (selectedFrom === undefined) {
      // First selection - set "from"
      setSelectedFrom(num);
      // Clear "to" if it was set, since maxTo might have changed
      setSelectedTo(undefined);
    } else if (selectedTo === undefined) {
      // Second selection - set "to" (but limit to maxTo)
      setSelectedTo(Math.min(num, maxTo));
    }
  };

  const handleClearFrom = () => {
    setSelectedFrom(undefined);
    setSelectedTo(undefined); // Clear both since "to" depends on "from"
  };

  const handleClearTo = () => {
    setSelectedTo(undefined);
  };

  const handleApply = () => {
    if (selectedFrom !== undefined && selectedTo !== undefined) {
      onApply(selectedFrom, selectedTo);
    } else if (selectedFrom !== undefined) {
      // If only "from" is selected, use same value for both
      onApply(selectedFrom, selectedFrom);
    }
  };

  const canApply = selectedFrom !== undefined;

  return (
    <View
      className={`rounded-xl border border-border bg-card p-4 ${className}`}
    >
      {/* Number scroll */}
      <ScrollViewComponent
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
        contentContainerClassName="gap-2 px-1"
      >
        {allNumbers.map((num, idx) => {
          const isSelectedFrom = num === selectedFrom;
          const isSelectedTo = num === selectedTo;
          const isSelected = isSelectedFrom || isSelectedTo;
          const selectable = isNumberSelectable(num);
          const label = formatLabel?.(num) ?? String(num);
          const usePill = !!formatLabel;

          // Detect chapter boundary for separator
          let showChapterSep = false;
          if (chapterSequence && idx > 0) {
            const prevEntry = chapterSequence[allNumbers[idx - 1]! - 1];
            const currEntry = chapterSequence[num - 1];
            if (prevEntry && currEntry && prevEntry.chapter !== currEntry.chapter) {
              showChapterSep = true;
            }
          }

          return (
            <React.Fragment key={num}>
              {showChapterSep && (
                <View className="mx-1 h-10 w-px bg-border" />
              )}
              <Pressable
                onPress={() => handleNumberPress(num)}
                disabled={!selectable}
                className={`h-10 items-center justify-center ${
                  usePill ? 'rounded-lg px-2.5' : 'w-10 rounded-full'
                } ${
                  isSelected
                    ? 'bg-primary'
                    : selectable
                      ? 'border border-primary/30 bg-primary/5'
                      : 'bg-muted/30'
                } ${selectable ? 'active:scale-95' : ''}`}
              >
                <Text
                  className={`font-medium ${usePill ? 'text-xs' : 'text-sm'} ${
                    isSelected
                      ? 'text-primary-foreground'
                      : selectable
                        ? 'text-primary'
                        : 'text-muted-foreground/40'
                  }`}
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
          onPress={selectedFrom !== undefined ? handleClearFrom : undefined}
          className={`h-12 min-w-20 flex-row items-center justify-center rounded-lg border px-3 ${
            selectedFrom !== undefined
              ? 'border-primary bg-primary/10'
              : 'border-dashed border-muted-foreground/30 bg-muted/30'
          }`}
        >
          {selectedFrom !== undefined ? (
            <>
              <Text className="text-lg font-semibold text-primary">
                {formatLabel?.(selectedFrom) ?? selectedFrom}
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
          onPress={selectedTo !== undefined ? handleClearTo : undefined}
          disabled={selectedFrom === undefined}
          className={`h-12 min-w-20 flex-row items-center justify-center rounded-lg border px-3 ${
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
                {formatLabel?.(selectedTo) ?? selectedTo}
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
        <Button
          variant="default"
          className="flex-1"
          onPress={handleApply}
          disabled={!canApply}
        >
          <Text className="text-primary-foreground">Apply</Text>
        </Button>
      </View>
    </View>
  );
}
