import React from 'react';
import { TextInput as RNTextInput, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { colors, sharedStyles, spacing } from '@/styles/theme';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
}

export function TextInput({ 
  value, 
  onChange, 
  placeholder, 
  error 
}: TextInputProps) {
  const inputStyle: StyleProp<TextStyle> = [
    styles.input,
    error ? styles.inputError : undefined
  ];

  return (
    <RNTextInput
      value={value || ''}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      style={inputStyle}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    ...sharedStyles.input,
    height: 48
  },
  inputError: {
    borderColor: 'red'
  }
});