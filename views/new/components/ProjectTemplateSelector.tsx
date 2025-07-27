import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { PROJECT_TEMPLATES } from '@/utils/projectTemplates';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ProjectType = 'custom' | 'template';

interface ProjectTemplateOption {
  id: string;
  name: string;
  description: string;
  questCount?: number;
  assetCount?: number;
  icon: keyof typeof Ionicons.glyphMap;
}

const CUSTOM_PROJECT_OPTION: ProjectTemplateOption = {
  id: 'custom',
  name: 'Custom Project',
  description:
    'Create an open-ended project where you can add your own quests and assets',
  icon: 'build-outline'
};

interface ProjectTemplateSelectorProps {
  selectedType: ProjectType;
  selectedTemplateId?: string;
  onTypeChange: (type: ProjectType) => void;
  onTemplateChange: (templateId: string | undefined) => void;
}

export const ProjectTemplateSelector: React.FC<
  ProjectTemplateSelectorProps
> = ({ selectedType, selectedTemplateId, onTypeChange, onTemplateChange }) => {
  const templateOptions: ProjectTemplateOption[] = PROJECT_TEMPLATES.map(
    (template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      questCount: template.questCount,
      assetCount: template.assetCount,
      icon: 'book-outline' as keyof typeof Ionicons.glyphMap
    })
  );

  const handleOptionPress = (option: ProjectTemplateOption) => {
    if (option.id === 'custom') {
      onTypeChange('custom');
      onTemplateChange(undefined);
    } else {
      onTypeChange('template');
      onTemplateChange(option.id);
    }
  };

  const renderOption = (option: ProjectTemplateOption) => {
    const isSelected =
      (option.id === 'custom' && selectedType === 'custom') ||
      (option.id !== 'custom' &&
        selectedType === 'template' &&
        selectedTemplateId === option.id);

    return (
      <TouchableOpacity
        key={option.id}
        style={[styles.option, isSelected && styles.selectedOption]}
        onPress={() => handleOptionPress(option)}
      >
        <View style={styles.optionHeader}>
          <View style={styles.optionIcon}>
            <Ionicons
              name={option.icon}
              size={24}
              color={isSelected ? colors.primary : colors.textSecondary}
            />
          </View>
          <View style={styles.optionContent}>
            <Text
              style={[
                styles.optionName,
                isSelected && styles.selectedOptionName
              ]}
            >
              {option.name}
            </Text>
            <Text style={styles.optionDescription}>{option.description}</Text>
            {option.questCount && option.assetCount && (
              <View style={styles.optionStats}>
                <Text style={styles.optionStatsText}>
                  {option.questCount.toLocaleString()} quests •{' '}
                  {option.assetCount.toLocaleString()} assets
                </Text>
              </View>
            )}
          </View>
          {isSelected && (
            <View style={styles.selectedIndicator}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={colors.primary}
              />
            </View>
          )}
        </View>

        {option.id !== 'custom' && (
          <View style={styles.templateNote}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.templateNoteText}>
              This will auto-populate your project with all chapters and verses
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Project Type</Text>
      <Text style={styles.sectionDescription}>
        Choose how you want to structure your project
      </Text>

      <View style={styles.optionsContainer}>
        {renderOption(CUSTOM_PROJECT_OPTION)}
        {templateOptions.map(renderOption)}

        {templateOptions.length > 1 && (
          <View style={styles.moreTemplates}>
            <Text style={styles.moreTemplatesText}>
              More templates coming soon!
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.medium
  },
  sectionTitle: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xsmall
  },
  sectionDescription: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    marginBottom: spacing.medium
  },
  optionsContainer: {
    gap: spacing.medium
  },
  option: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10'
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  optionIcon: {
    marginRight: spacing.medium,
    marginTop: 2
  },
  optionContent: {
    flex: 1
  },
  optionName: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xsmall
  },
  selectedOptionName: {
    color: colors.primary
  },
  optionDescription: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.small
  },
  optionStats: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xsmall,
    alignSelf: 'flex-start'
  },
  optionStatsText: {
    fontSize: fontSizes.xsmall,
    color: colors.primary,
    fontWeight: '600'
  },
  selectedIndicator: {
    marginLeft: spacing.small,
    marginTop: 2
  },
  templateNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.small,
    paddingTop: spacing.small,
    borderTopWidth: 1,
    borderTopColor: colors.inputBackground
  },
  templateNoteText: {
    fontSize: fontSizes.xsmall,
    color: colors.textSecondary,
    marginLeft: spacing.xsmall,
    flex: 1,
    fontStyle: 'italic'
  },
  moreTemplates: {
    alignItems: 'center',
    paddingVertical: spacing.small
  },
  moreTemplatesText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    fontStyle: 'italic'
  }
});
