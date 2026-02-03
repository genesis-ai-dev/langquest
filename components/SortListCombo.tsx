import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  getOptionFromValue
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import React from 'react';
import { View } from 'react-native';

export interface SortListComboProps {
  options: string[];
  onSelectionChange?: (selection: {
    first: string | undefined;
    second: string | undefined;
    third: string | undefined;
  }) => void;
  className?: string;
  placeholder1?: string;
  placeholder2?: string;
  placeholder3?: string;
}

export function SortListCombo({
  options,
  onSelectionChange,
  className = '',
  placeholder1 = 'Select first option',
  placeholder2 = 'Select second option',
  placeholder3 = 'Select third option'
}: SortListComboProps) {
  const [selected1, setSelected1] = React.useState<string | undefined>();
  const [selected2, setSelected2] = React.useState<string | undefined>();
  const [selected3, setSelected3] = React.useState<string | undefined>();

  // Notify parent when selection changes
  React.useEffect(() => {
    onSelectionChange?.({
      first: selected1,
      second: selected2,
      third: selected3
    });
  }, [selected1, selected2, selected3, onSelectionChange]);

  // Filter options for second combobox (exclude selected1)
  const options2 = React.useMemo(() => {
    return options.filter((option) => option !== selected1);
  }, [options, selected1]);

  // Filter options for third combobox (exclude selected1 and selected2)
  const options3 = React.useMemo(() => {
    return options.filter(
      (option) => option !== selected1 && option !== selected2
    );
  }, [options, selected1, selected2]);

  const handleFirstChange = (value: string) => {
    setSelected1(value);
    setSelected2(undefined);
    setSelected3(undefined);
  };

  const handleSecondChange = (value: string) => {
    setSelected2(value);
    setSelected3(undefined);
  };

  return (
    <View className={`rounded-md border border-input bg-card p-3 ${className}`}>
      <Text className="mb-2 text-xs text-foreground">Group by</Text>
      <View className="flex flex-row gap-2">
        <View className="flex-1">
          <Select
            value={getOptionFromValue(selected1)}
            onValueChange={(option) => {
              if (option) {
                handleFirstChange(option.value);
              }
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={placeholder1} className="text-xs" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem
                  key={option}
                  value={option}
                  label={option}
                  showCheckIcon={false}
                  textClassName="text-xs"
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>
        <View className="flex-1">
          <Select
            value={getOptionFromValue(selected2)}
            onValueChange={(option) => {
              if (option && selected1) {
                handleSecondChange(option.value);
              }
            }}
          >
            <SelectTrigger disabled={!selected1} className="h-9 text-xs">
              <SelectValue placeholder={placeholder2} className="text-xs" />
            </SelectTrigger>
            <SelectContent>
              {options2.map((option) => (
                <SelectItem
                  key={option}
                  value={option}
                  label={option}
                  showCheckIcon={false}
                  textClassName="text-xs"
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>
        <View className="flex-1">
          <Select
            value={getOptionFromValue(selected3)}
            onValueChange={(option) => {
              if (option && selected2) {
                setSelected3(option.value);
              }
            }}
          >
            <SelectTrigger disabled={!selected2} className="h-9 text-xs">
              <SelectValue placeholder={placeholder3} className="text-xs" />
            </SelectTrigger>
            <SelectContent>
              {options3.map((option) => (
                <SelectItem
                  key={option}
                  value={option}
                  label={option}
                  showCheckIcon={false}
                  textClassName="text-xs"
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>
      </View>
    </View>
  );
}
