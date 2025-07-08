import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { colors } from '@/styles/theme';
import { storage } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { OfflineUndownloadWarning } from './OfflineUndownloadWarning';

interface DownloadIndicatorProps {
  isDownloaded: boolean;
  isLoading: boolean;
  onPress: () => void;
  size?: number;
  // Enhanced props for quest download progress
  progressPercentage?: number;
  showProgress?: boolean;
}

export const DownloadIndicator: React.FC<DownloadIndicatorProps> = ({
  isDownloaded,
  isLoading,
  onPress,
  size = 24,
  progressPercentage = 0,
  showProgress = false
}) => {
  const isConnected = useNetworkStatus();
  const isDisabled = !isConnected && !isDownloaded;
  const [showWarning, setShowWarning] = useState(false);

  const handlePress = async () => {
    console.log('isConnected', isConnected);
    console.log('isDownloaded', isDownloaded);
    if (!isConnected && isDownloaded) {
      const showWarning = await storage.getOfflineUndownloadWarningEnabled();
      console.log('showWarning', showWarning);
      if (showWarning) {
        setShowWarning(true);
        return;
      }
    }
    onPress();
  };

  const handleConfirm = () => {
    setShowWarning(false);
    onPress();
  };

  const handleCancel = () => {
    setShowWarning(false);
  };

  // Determine icon and color based on state
  const getIconAndColor = () => {
    if (isDownloaded) {
      return {
        name: 'arrow-down-circle' as const,
        color: colors.primary
      };
    }

    if (showProgress && progressPercentage > 0) {
      return {
        name: 'arrow-down-circle-outline' as const, // Will show a partial download indicator
        color: colors.accent
      };
    }

    return {
      name: 'arrow-down-circle-outline' as const,
      color: isDisabled ? colors.disabled : colors.text
    };
  };

  const { name: iconName, color } = getIconAndColor();

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        style={[isDisabled && styles.disabled]}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        disabled={isDisabled || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size={size} color={colors.primary} />
        ) : showProgress && progressPercentage > 0 && !isDownloaded ? (
          // Custom progress indicator for quests
          <View
            style={[styles.progressContainer, { width: size, height: size }]}
          >
            <View
              style={[
                styles.progressBackground,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2
                }
              ]}
            />
            <View
              style={[
                styles.progressFill,
                {
                  width: size * (progressPercentage / 100),
                  height: size,
                  borderRadius: size / 2
                }
              ]}
            />
            <Ionicons
              name="arrow-down-circle-outline"
              size={size}
              color={color}
              style={styles.progressIcon}
            />
          </View>
        ) : (
          <Ionicons name={iconName} size={size} color={color} />
        )}
      </TouchableOpacity>
      <OfflineUndownloadWarning
        visible={showWarning}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5
  },
  progressContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  progressBackground: {
    position: 'absolute',
    backgroundColor: colors.disabled,
    opacity: 0.3
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    backgroundColor: colors.accent,
    opacity: 0.6
  },
  progressIcon: {
    position: 'absolute'
  }
});
