import { colors, fontSizes, spacing } from '@/styles/theme';
import { StyleSheet, Switch, Text, View } from 'react-native';

interface SwitchBoxProps {
  title: string;
  description: string;
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function SwitchBox({
  title,
  description,
  value,
  onChange,
  disabled = false
}: SwitchBoxProps) {
  return (
    <View style={styles.content}>
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text
            style={disabled ? styles.settingTitleDisabled : styles.settingTitle}
          >
            {title}
          </Text>
          <Text
            style={
              disabled
                ? styles.settingDescriptionDisabled
                : styles.settingDescription
            }
          >
            {description}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={() => onChange()}
          disabled={disabled}
          trackColor={{
            false: colors.disabled,
            true: disabled ? colors.disabled : colors.primary
          }}
          thumbColor={!value || disabled ? colors.disabled : colors.primary}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.small
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.medium
  },
  settingTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xsmall
  },
  settingDescription: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  settingTitleDisabled: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xsmall,
    opacity: 0.6
  },
  settingDescriptionDisabled: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    opacity: 0.6
  }
});
