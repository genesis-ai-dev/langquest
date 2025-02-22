import { colors, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface DownloadIndicatorProps {
  isDownloaded: boolean;
  onPress: () => void;
  size?: number;
}

export const DownloadIndicator: React.FC<DownloadIndicatorProps> = ({
  isDownloaded,
  onPress,
  size = 24
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.container}
      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
    >
      <Ionicons
        name={isDownloaded ? 'cloud-done' : 'cloud-download-outline'}
        size={size}
        color={isDownloaded ? colors.primary : colors.text}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: spacing.small,
    right: spacing.small,
    zIndex: 1
  }
});
