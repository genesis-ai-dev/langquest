import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PasswordInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: any;
  placeholderTextColor?: string;
}

export const PasswordInput = ({
  value,
  onChangeText,
  placeholder = 'Password',
  style,
  placeholderTextColor
}: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, style]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        placeholder={placeholder}
        style={[styles.input, { color: style?.color }]}
        placeholderTextColor={placeholderTextColor}
      />
      <TouchableOpacity
        onPress={() => {
          setShowPassword(!showPassword);
        }}
        activeOpacity={1}
        style={styles.icon}
      >
        <Ionicons
          name={showPassword ? 'eye-off' : 'eye'}
          size={24}
          color={placeholderTextColor}
          style={{ opacity: 0.7 }}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  input: {
    flex: 1
  },
  icon: {
    // padding: 10
  }
});
