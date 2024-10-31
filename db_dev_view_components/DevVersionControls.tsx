import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, sharedStyles } from '@/styles/theme';
import { VersionedEntity } from '@/database_components/VersionedRepository';

interface VersionControlsProps<T extends VersionedEntity> {
  versions: T[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  disabled?: boolean; 
}

export function DevVersionControls<T extends VersionedEntity>({ 
  versions, 
  currentIndex, 
  setCurrentIndex,
  disabled = false
}: VersionControlsProps<T>) {
  if (!versions.length) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
      <TouchableOpacity 
        onPress={() => setCurrentIndex(Math.min(currentIndex + 1, versions.length - 1))}
        disabled={disabled || currentIndex >= versions.length - 1}
      >
        <Ionicons 
          name="chevron-back" 
          size={24} 
          color={disabled || currentIndex >= versions.length - 1 ? colors.textSecondary : colors.text} 
        />
      </TouchableOpacity>
      <Text style={{ color: colors.text, marginHorizontal: 8 }}>
        Version {versions[currentIndex]?.versionNum || 1}
      </Text>
      <TouchableOpacity 
        onPress={() => setCurrentIndex(Math.max(currentIndex - 1, 0))}
        disabled={disabled || currentIndex <= 0}
      >
        <Ionicons 
          name="chevron-forward" 
          size={24} 
          color={disabled || currentIndex <= 0 ? colors.textSecondary : colors.text} 
        />
      </TouchableOpacity>
    </View>
  );
}