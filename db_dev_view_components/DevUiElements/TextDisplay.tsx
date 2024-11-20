import React from 'react';
import { Text } from 'react-native';
import { colors } from '@/styles/theme';

interface TextDisplayProps {
  value: string;
}

export function TextDisplay({ value }: TextDisplayProps) {
  return (
    <Text style={{ color: colors.text }}>
      {value || ''}
    </Text>
  );
}