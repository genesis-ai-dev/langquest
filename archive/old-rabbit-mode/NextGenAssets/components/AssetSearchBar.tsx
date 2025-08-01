import { useLocalization } from '@/hooks/useLocalization';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

interface AssetSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearching?: boolean;
}

export const AssetSearchBar: React.FC<AssetSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  isSearching = false
}) => {
  const { t } = useLocalization();

  return (
    <View style={styles.searchContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder={t('searchAssets')}
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholderTextColor={colors.textSecondary}
      />
      <View style={styles.searchIconContainer}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
      </View>
      {isSearching && searchQuery && (
        <View style={styles.searchLoadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium,
    position: 'relative'
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    paddingLeft: 40,
    color: colors.text,
    fontSize: fontSizes.medium
  },
  searchIconContainer: {
    position: 'absolute',
    left: spacing.small,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30
  },
  searchLoadingContainer: {
    position: 'absolute',
    right: spacing.small,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30
  }
});
