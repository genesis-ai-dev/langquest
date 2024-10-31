import React from 'react';
import { Switch as RNSwitch, StyleSheet } from 'react-native';
import { colors } from '@/styles/theme';

interface SwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function Switch({ value, onChange }: SwitchProps) {
  return (
    <RNSwitch
      value={value || false}
      onValueChange={onChange}
      trackColor={{ false: colors.backgroundSecondary, true: colors.primary }}
      thumbColor={colors.text}
      ios_backgroundColor={colors.backgroundSecondary}
      style={styles.switch}
    />
  );
}

const styles = StyleSheet.create({
  switch: {
    alignSelf: 'flex-start'
  }
});