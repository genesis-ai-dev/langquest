import React, { useState } from 'react';
import { View, TextInput as RNTextInput, TouchableOpacity, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, sharedStyles, spacing } from '@/styles/theme';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
}

export function PasswordInput({ 
  value, 
  onChange, 
  placeholder, 
  error 
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const inputStyle: StyleProp<TextStyle> = [
    styles.input,
    error ? styles.inputError : undefined
  ];

  return (
    <View style={styles.container}>
      <RNTextInput
        value={value || ''}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        secureTextEntry={!showPassword}
        style={inputStyle}
      />
      <TouchableOpacity 
        style={styles.eyeIcon}
        onPress={() => setShowPassword(!showPassword)}
      >
        <Ionicons 
          name={showPassword ? 'eye-off' : 'eye'} 
          size={24} 
          color={colors.textSecondary} 
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative'
  },
  input: {
    ...sharedStyles.input,
    height: 48,
    paddingRight: 48 // Space for eye icon
  },
  inputError: {
    borderColor: 'red'
  },
  eyeIcon: {
    position: 'absolute',
    right: spacing.medium,
    height: '100%',
    justifyContent: 'center'
  }
});