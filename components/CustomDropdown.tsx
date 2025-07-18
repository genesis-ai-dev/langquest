import { useLocalization } from '@/hooks/useLocalization';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';

interface DropdownOption {
  label: string;
  value: string;
}

interface CustomDropdownProps {
  label?: string;
  value: string;
  options: string[] | DropdownOption[];
  onSelect: (option: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  fullWidth?: boolean;
  search?: boolean;
  searchPlaceholder?: string;
  containerStyle?: object;
  renderLeftIcon?: (visible?: boolean) => JSX.Element | null | undefined;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  value,
  options,
  onSelect,
  isOpen,
  onToggle,
  fullWidth = true,
  search = true,
  searchPlaceholder,
  containerStyle,
  renderLeftIcon
}) => {
  const { t } = useLocalization();
  const data: DropdownOption[] = options.map((option) => {
    if (typeof option === 'string') {
      return { label: option, value: option };
    }
    return option;
  });

  return (
    <View
      style={[
        styles.container,
        fullWidth ? styles.fullWidth : styles.halfWidth,
        containerStyle
      ]}
    >
      {label && <Text style={styles.label}>{label}:</Text>}
      <Dropdown
        style={styles.dropdown}
        renderLeftIcon={renderLeftIcon}
        containerStyle={styles.dropdownContainer}
        placeholderStyle={styles.placeholderStyle}
        selectedTextStyle={styles.selectedTextStyle}
        inputSearchStyle={styles.inputSearchStyle}
        iconStyle={styles.iconStyle}
        activeColor={colors.primaryLight}
        data={data}
        search={search}
        maxHeight={300}
        labelField="label"
        valueField="value"
        placeholder={t('selectItem')}
        searchPlaceholder={searchPlaceholder || t('search')}
        value={value}
        onChange={(item) => {
          onSelect(item.value);
        }}
        onFocus={onToggle}
        onBlur={onToggle}
        renderItem={(item, selected) => (
          <View style={[styles.item, selected && styles.selectedItem]}>
            <Text
              style={[styles.itemText, selected && styles.selectedItemText]}
            >
              {item.label}
            </Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // marginBottom: spacing.medium,
  },
  fullWidth: {
    width: '100%'
  },
  halfWidth: {
    flex: 1,
    marginRight: spacing.small
  },
  label: {
    color: colors.text,
    marginBottom: spacing.small
  },
  dropdown: {
    height: 50,
    backgroundColor: colors.inputBackground,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.medium
  },
  dropdownContainer: {
    backgroundColor: colors.background,
    // backgroundColor: colors.inputBackground,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    marginTop: 8
  },
  searchContainer: {
    borderBottomColor: colors.primary,
    borderBottomWidth: 1,
    padding: 0
  },
  inputSearchStyle: {
    height: 40,
    fontSize: fontSizes.medium,
    color: colors.text,
    borderRadius: 0,
    margin: 0,
    padding: spacing.small
  },
  item: {
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary
  },
  icon: {
    marginRight: spacing.small
  },
  placeholderStyle: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  selectedTextStyle: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  iconStyle: {
    width: 20,
    height: 20
  },
  selectedItem: {
    backgroundColor: colors.primary
  },
  itemText: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  selectedItemText: {
    color: colors.buttonText
  }
});
