import { XIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface VerseRangeSelectorProps {
  from: number;
  to: number;
  selectedFrom?: number;
  selectedTo?: number;
  onApply: (from: number, to: number) => void;
  onCancel: () => void;
  className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ScrollViewComponent?: React.ComponentType<any>;
}

export function VerseRangeSelector({
  from,
  to,
  selectedFrom: initialFrom,
  selectedTo: initialTo,
  onApply,
  onCancel,
  className = '',
  ScrollViewComponent = ScrollView
}: VerseRangeSelectorProps) {
  const [selectedFrom, setSelectedFrom] = React.useState<number | undefined>(
    initialFrom
  );
  const [selectedTo, setSelectedTo] = React.useState<number | undefined>(
    initialTo
  );

  // Generate array of numbers from `from` to `to`
  const allNumbers = React.useMemo(() => {
    const numbers: number[] = [];
    for (let i = from; i <= to; i++) {
      numbers.push(i);
    }
    return numbers;
  }, [from, to]);

  // Check if a number is selectable based on current selection state
  const isNumberSelectable = React.useCallback(
    (num: number) => {
      // If nothing selected, all numbers are selectable
      if (selectedFrom === undefined) {
        return true;
      }
      // If only "from" selected, only numbers >= selectedFrom are selectable
      if (selectedTo === undefined) {
        return num >= selectedFrom;
      }
      // If both selected, nothing is selectable (user must clear first)
      return false;
    },
    [selectedFrom, selectedTo]
  );

  const handleNumberPress = (num: number) => {
    if (!isNumberSelectable(num)) return;

    if (selectedFrom === undefined) {
      // First selection - set "from"
      setSelectedFrom(num);
    } else if (selectedTo === undefined) {
      // Second selection - set "to"
      setSelectedTo(num);
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
        {allNumbers.map((num) => {
          const isSelectedFrom = num === selectedFrom;
          const isSelectedTo = num === selectedTo;
          const isSelected = isSelectedFrom || isSelectedTo;
          const selectable = isNumberSelectable(num);

          return (
            <Pressable
              key={num}
              onPress={() => handleNumberPress(num)}
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
                {num}
              </Text>
            </Pressable>
          );
        })}
      </ScrollViewComponent>

      {/* Selected inputs */}
      <View className="mb-4 flex-row items-center justify-center gap-3">
        {/* From input */}
        <Pressable
          onPress={selectedFrom !== undefined ? handleClearFrom : undefined}
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
          onPress={selectedTo !== undefined ? handleClearTo : undefined}
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
