import { colors, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { OfflineUndownloadWarning } from './OfflineUndownloadWarning';
import { storage } from '@/utils/storage';

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
  const isConnected = useNetworkConnectivity();
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

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        style={[styles.container, isDisabled && styles.disabled]}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        disabled={isDisabled}
      >
        <Ionicons
          name={isDownloaded ? 'cloud-done' : 'cloud-download-outline'}
          size={size}
          color={
            isDownloaded
              ? colors.primary
              : isDisabled
                ? colors.disabled
                : colors.text
          }
        />
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
  container: {
    position: 'absolute',
    top: spacing.small,
    right: spacing.small,
    zIndex: 1
  },
  disabled: {
    opacity: 0.5
  }
});
