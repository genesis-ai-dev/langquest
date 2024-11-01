import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, sharedStyles } from '@/styles/theme';
import { VersionedEntity } from '@/database_components/VersionedRepository';
import { DevCardProps } from './DevTypes';

export function DevCardView<T extends VersionedEntity>({ 
  entity, 
  config, 
  onSelect 
}: DevCardProps<T>) {
  // Helper function to safely get nested property values
  const getPropertyValue = (obj: any, key: string): string => {
    const value = obj[key];
    if (value === undefined || value === null) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  return (
    <TouchableOpacity 
      onPress={() => onSelect(entity)}
      style={[
        sharedStyles.card,
        { marginBottom: 8, padding: 12 }
      ]}
    >
      {/* Title */}
      <Text style={[
        sharedStyles.cardTitle,
        { fontSize: 18, fontWeight: '600', color: colors.text }
      ]}>
        {getPropertyValue(entity, config.title)}
      </Text>

      {/* Subtitle */}
      <Text style={[
        sharedStyles.cardSubtitle,
        { fontSize: 16, color: colors.textSecondary, marginTop: 4 }
      ]}>
        {getPropertyValue(entity, config.subtitle)}
      </Text>

      {/* Properties */}
      <View style={{ 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        marginTop: 8,
        gap: 8
      }}>
        {config.properties.map((prop, index) => (
          <Text 
            key={prop}
            style={[
              sharedStyles.cardProperty,
              { 
                fontSize: 14, 
                color: colors.textSecondary,
                backgroundColor: colors.backgroundSecondary,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 4
              }
            ]}
          >
            {`${prop}: ${getPropertyValue(entity, prop)}`}
          </Text>
        ))}
      </View>

      {/* Version Badge */}
      <View style={{
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: colors.accent,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12
      }}>
        <Text style={{ 
          color: colors.buttonText,
          fontSize: 12 
        }}>
          v{entity.versionNum || 1}
        </Text>
      </View>
    </TouchableOpacity>
  );
}