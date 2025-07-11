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
import { DownloadConfirmationModal } from './DownloadConfirmationModal';
import { OfflineUndownloadWarning } from './OfflineUndownloadWarning';

interface DownloadIndicatorProps {
  isFlaggedForDownload: boolean;
  isLoading: boolean;
  onPress: () => void;
  size?: number;
  // Enhanced props for quest download progress
  progressPercentage?: number;
  showProgress?: boolean;
  // New props for download confirmation
  downloadType?: 'project' | 'quest';
  stats?: {
    totalAssets: number;
    totalTranslations?: number;
    totalQuests?: number;
  };
}

export const DownloadIndicator: React.FC<DownloadIndicatorProps> = ({
  isFlaggedForDownload,
  isLoading,
  onPress,
  size = 24,
  progressPercentage = 0,
  showProgress = false,
  downloadType,
  stats
}) => {
  const isConnected = useNetworkStatus();
  const isDisabled = !isConnected && !isFlaggedForDownload;
  const [showWarning, setShowWarning] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handlePress = async () => {
    if (!isConnected && isFlaggedForDownload) {
      const showWarning = await storage.getOfflineUndownloadWarningEnabled();
      if (showWarning) {
        setShowWarning(true);
        return;
      }
    }

    // Show confirmation modal for project/quest downloads (not already downloaded)
    if (downloadType && stats && !isFlaggedForDownload) {
      setShowConfirmation(true);
      return;
    }

    // Direct download for assets or already downloaded items
    onPress();
  };

  const handleConfirmDownload = () => {
    setShowConfirmation(false);
    onPress();
  };

  const handleCancelDownload = () => {
    setShowConfirmation(false);
  };

  const handleConfirmUndownload = () => {
    setShowWarning(false);
    onPress();
  };

  const handleCancelUndownload = () => {
    setShowWarning(false);
  };

  // Determine icon and color based on state
  const getIconAndColor = () => {
    if (isFlaggedForDownload) {
      return {
        name: 'checkmark-circle' as const,
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
        ) : showProgress && progressPercentage > 0 && !isFlaggedForDownload ? (
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

      {/* Download confirmation modal */}
      {downloadType && stats && (
        <DownloadConfirmationModal
          visible={showConfirmation}
          onConfirm={handleConfirmDownload}
          onCancel={handleCancelDownload}
          downloadType={downloadType}
          stats={stats}
        />
      )}

      {/* Offline undownload warning */}
      <OfflineUndownloadWarning
        visible={showWarning}
        onConfirm={handleConfirmUndownload}
        onCancel={handleCancelUndownload}
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
