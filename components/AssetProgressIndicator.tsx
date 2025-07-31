import type { RabbitModeAsset } from '@/store/localStore';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface AssetProgressIndicatorProps {
  assets: RabbitModeAsset[];
  currentAssetId?: string;
  onAssetSelect: (assetId: string) => void;
}

export const AssetProgressIndicator: React.FC<AssetProgressIndicatorProps> = ({
  assets,
  currentAssetId,
  onAssetSelect
}) => {
  if (assets.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assets ({assets.length})</Text>
      <ScrollView
        horizontal
        style={styles.scrollView}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {assets.map((asset, index) => {
          const isActive = asset.id === currentAssetId;
          const hasSegments = asset.segments.length > 0;

          return (
            <TouchableOpacity
              key={asset.id}
              style={[
                styles.assetItem,
                isActive && styles.assetItemActive,
                asset.isLocked && styles.assetItemLocked
              ]}
              onPress={() => onAssetSelect(asset.id)}
            >
              <View style={styles.assetHeader}>
                <Text
                  style={[
                    styles.assetNumber,
                    isActive && styles.assetNumberActive
                  ]}
                  numberOfLines={1}
                >
                  {index + 1}
                </Text>
                <Ionicons
                  name={
                    asset.isLocked
                      ? 'checkmark-circle'
                      : hasSegments
                        ? 'radio-button-on'
                        : 'radio-button-off'
                  }
                  size={14}
                  color={
                    asset.isLocked
                      ? colors.success
                      : hasSegments
                        ? colors.primary
                        : colors.textSecondary
                  }
                />
              </View>

              <Text
                style={[styles.assetName, isActive && styles.assetNameActive]}
                numberOfLines={2}
              >
                {asset.name}
              </Text>

              <View style={styles.assetStats}>
                <Text style={styles.segmentCount}>
                  {asset.segments.length} seg
                  {asset.segments.length !== 1 ? 's' : ''}
                </Text>
                {asset.isLocked && (
                  <Ionicons
                    name="lock-closed"
                    size={10}
                    color={colors.success}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.small
  },
  title: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xsmall,
    paddingHorizontal: spacing.medium
  },
  scrollView: {
    flexGrow: 0
  },
  scrollContent: {
    paddingHorizontal: spacing.medium,
    gap: spacing.small
  },
  assetItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.small,
    width: 120,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  assetItemActive: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primaryLight
  },
  assetItemLocked: {
    borderColor: colors.success,
    backgroundColor: colors.primaryLight
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xsmall
  },
  assetNumber: {
    fontSize: fontSizes.small,
    fontWeight: '600',
    color: colors.textSecondary,
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 20,
    textAlign: 'center'
  },
  assetNumberActive: {
    color: colors.primary,
    backgroundColor: colors.background
  },
  assetName: {
    fontSize: fontSizes.small,
    color: colors.text,
    fontWeight: '500',
    marginBottom: spacing.xsmall,
    lineHeight: 16
  },
  assetNameActive: {
    color: colors.primary,
    fontWeight: '600'
  },
  assetStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  segmentCount: {
    fontSize: fontSizes.xsmall,
    color: colors.textSecondary,
    fontWeight: '500'
  }
});
