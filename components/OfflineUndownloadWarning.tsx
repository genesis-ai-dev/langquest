import { useLocalization } from '@/hooks/useLocalization';
import { colors, spacing } from '@/styles/theme';
import { storage } from '@/utils/storage';
import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface OfflineUndownloadWarningProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const OfflineUndownloadWarning: React.FC<
  OfflineUndownloadWarningProps
> = ({ visible, onConfirm, onCancel }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { t } = useLocalization();

  const handleConfirm = async () => {
    if (dontShowAgain) {
      await storage.setOfflineUndownloadWarningEnabled(false);
    }
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{t('offlineUndownloadWarning')}</Text>
          <Text style={styles.message}>{t('offlineUndownloadMessage')}</Text>
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>{t('dontShowAgain')}</Text>
            <Switch
              value={dontShowAgain}
              onValueChange={setDontShowAgain}
              trackColor={{
                false: colors.textSecondary,
                true: colors.primary // Use primary color for better contrast
              }}
              thumbColor={
                dontShowAgain ? colors.primary : colors.inputBackground
              }
            />
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.buttonText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirm}
            >
              <Text style={styles.buttonText}>{t('confirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  dialog: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.medium,
    width: '80%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium
  },
  message: {
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.medium
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.medium
  },
  switchLabel: {
    fontSize: 14,
    color: colors.textSecondary
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.small
  },
  button: {
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 5
  },
  cancelButton: {
    backgroundColor: colors.inputBackground
  },
  confirmButton: {
    backgroundColor: colors.primary
  },
  buttonText: {
    color: colors.buttonText,
    fontWeight: 'bold'
  }
});
