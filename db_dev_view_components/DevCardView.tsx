import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, sharedStyles } from '@/styles/theme';
import { VersionedEntity } from '@/database_components/VersionedRepository';
import { DevCardProps } from './DevTypes';
import { FieldResolver } from '@/database_components/fieldResolver';

export function DevCardView<T extends VersionedEntity>({ 
  entity, 
  config,  // This is now the full TableConfig
  onSelect 
}: DevCardProps<T>) {
  const [resolvedValues, setResolvedValues] = useState<{
    title: { value: string; loading: boolean };
    subtitle: { value: string; loading: boolean };
    properties: Record<string, { value: string; loading: boolean }>;
  }>({
    title: { value: 'Loading...', loading: true },
    subtitle: { value: 'Loading...', loading: true },
    properties: {}
  });

  useEffect(() => {
    const resolveFields = async () => {
      try {
        // Resolve title using FieldResolver with repository
        const title = await FieldResolver.resolveFieldValue(
          entity, 
          config.card.title,
          config.repository  // Now we have access to the repository
        );

        // Resolve subtitle using FieldResolver with repository
        const subtitle = await FieldResolver.resolveFieldValue(
          entity, 
          config.card.subtitle,
          config.repository
        );

        // Resolve properties using FieldResolver with repository
        const propertyValues: Record<string, { value: string; loading: boolean }> = {};
        for (const property of config.card.properties) {
          try {
            const value = await FieldResolver.resolveFieldValue(
              entity, 
              property,
              config.repository
            );
            propertyValues[property.field] = { value, loading: false };
          } catch (error) {
            console.error(`Error resolving property ${property.field}:`, error);
            propertyValues[property.field] = { value: 'Error loading', loading: false };
          }
        }

        setResolvedValues({
          title: { value: title, loading: false },
          subtitle: { value: subtitle, loading: false },
          properties: propertyValues
        });
      } catch (error) {
        console.error('Error resolving field values:', error);
        setResolvedValues(prev => ({
          ...prev,
          title: { value: 'Error loading', loading: false },
          subtitle: { value: 'Error loading', loading: false }
        }));
      }
    };

    resolveFields();
  }, [entity, config]);

  return (
    <TouchableOpacity 
      onPress={() => onSelect(entity)}
      style={[sharedStyles.card, { marginBottom: 8, padding: 12 }]}
    >
      {/* Title */}
      <Text style={[
        sharedStyles.cardTitle,
        { 
          fontSize: 18, 
          fontWeight: '600',
          color: resolvedValues.title.loading ? colors.textSecondary : colors.text 
        }
      ]}>
        {resolvedValues.title.value}
      </Text>

      {/* Subtitle */}
      <Text style={[
        sharedStyles.cardSubtitle,
        { 
          fontSize: 16,
          color: resolvedValues.subtitle.loading ? colors.textSecondary : colors.textSecondary,
          marginTop: 4 
        }
      ]}>
        {resolvedValues.subtitle.value}
      </Text>

      {/* Properties */}
      <View style={{ 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        marginTop: 8,
        gap: 8
      }}>
        {config.card.properties.map((prop) => (
          <Text 
            key={prop.field}
            style={[
              sharedStyles.cardProperty,
              { 
                fontSize: 14,
                color: resolvedValues.properties[prop.field]?.loading ? 
                  colors.textSecondary : colors.textSecondary,
                backgroundColor: colors.backgroundSecondary,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 4,
                opacity: resolvedValues.properties[prop.field]?.loading ? 0.7 : 1
              }
            ]}
          >
            {`${prop.field}: ${resolvedValues.properties[prop.field]?.value || 'Loading...'}`}
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