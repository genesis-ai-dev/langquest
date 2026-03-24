import { Button } from '@/components/ui/button';
import { colors } from '@/styles/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Option {
  label: string;
  value: string;
}

interface Props {
  options: Option[];
  borderColor: string;
  fillColor: string;
  textColor: string;
  value: string | null;
  onChange: (value: string) => void;
}

export default function RadioSelect({
  options,
  borderColor,
  fillColor,
  textColor,
  value,
  onChange
}: Props) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Button
            variant="plain"
            key={option.value}
            style={styles.option}
            onPress={() => onChange(option.value)}
          >
            <View
              style={[
                styles.circle,
                { borderColor: borderColor },
                selected && { backgroundColor: fillColor }
              ]}
            />
            <Text style={[styles.label, { color: textColor }]}>
              {option.label}
            </Text>
          </Button>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 8,
    color: colors.text
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2
  },
  circle: {
    width: 16,
    height: 16,
    borderRadius: 10,
    borderWidth: 2,
    // borderColor: '#6200ee',
    marginRight: 10
  },
  // selectedCircle: {
  //   backgroundColor: '#6200ee'
  // },
  label: {
    fontSize: 14
  }
});
