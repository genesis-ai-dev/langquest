import { useLocalStore } from '@/store/localStore';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

interface AssetLockButtonProps {
  sessionId: string;
  assetId: string;
  isLocked: boolean;
  disabled?: boolean;
  onLockToggle?: () => void;
}

export const AssetLockButton: React.FC<AssetLockButtonProps> = ({
  sessionId,
  assetId,
  isLocked,
  disabled = false,
  onLockToggle
}) => {
  const handleToggle = () => {
    if (disabled) return;

    if (isLocked) {
      useLocalStore.getState().unlockAsset(sessionId, assetId);
    } else {
      useLocalStore.getState().lockAsset(sessionId, assetId);
    }

    onLockToggle?.();
  };

  return (
    <TouchableOpacity
      style={[
        styles.lockButton,
        isLocked && styles.lockButtonLocked,
        disabled && styles.lockButtonDisabled
      ]}
      onPress={handleToggle}
      disabled={disabled}
    >
      <Ionicons
        name={isLocked ? 'lock-closed' : 'lock-open'}
        size={16}
        color={
          disabled
            ? colors.disabled
            : isLocked
              ? colors.success
              : colors.textSecondary
        }
      />
      <Text
        style={[
          styles.lockButtonText,
          isLocked && styles.lockButtonTextLocked,
          disabled && styles.lockButtonTextDisabled
        ]}
      >
        {isLocked ? 'Locked' : 'Lock'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 6,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xsmall,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    gap: spacing.xsmall
  },
  lockButtonLocked: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.success
  },
  lockButtonDisabled: {
    opacity: 0.5
  },
  lockButtonText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  lockButtonTextLocked: {
    color: colors.success,
    fontWeight: '600'
  },
  lockButtonTextDisabled: {
    color: colors.disabled
  }
});
