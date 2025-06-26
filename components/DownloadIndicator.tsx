import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { colors } from '@/styles/theme';
import { storage } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { OfflineUndownloadWarning } from './OfflineUndownloadWarning';

interface DownloadIndicatorProps {
  isDownloaded: boolean;
  isLoading: boolean;
  onPress: () => void;
  size?: number;
}

export const DownloadIndicator: React.FC<DownloadIndicatorProps> = ({
  isDownloaded,
  isLoading,
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
        style={[isDisabled && styles.disabled]}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        disabled={isDisabled || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size={size} color={colors.primary} />
        ) : (
          <Ionicons
            name={
              isDownloaded ? 'arrow-down-circle' : 'arrow-down-circle-outline'
            }
            size={size}
            color={
              isDownloaded
                ? colors.primary
                : isDisabled
                  ? colors.disabled
                  : colors.text
            }
          />
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
  }
});
