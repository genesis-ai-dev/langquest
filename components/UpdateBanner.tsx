import { useExpoUpdates } from '@/hooks/useExpoUpdates';
import { useLocalization } from '@/hooks/useLocalization';
import { colors } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export function UpdateBanner() {
  const { t } = useLocalization();
  const {
    updateInfo,
    isDownloadingUpdate,
    downloadUpdate,
    downloadError,
    dismissBanner
  } = useExpoUpdates();

  if (!updateInfo?.isUpdateAvailable) {
    return null;
  }

  const handleDownload = async () => {
    try {
      await downloadUpdate();
    } catch (error) {
      console.error('[UpdateBanner] Download failed:', error);
      // Error is tracked in downloadError, will show in UI
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons
          name="cloud-download-outline"
          size={20}
          color={colors.primary}
        />
        <View style={styles.textContainer}>
          <Text style={styles.text}>
            {downloadError ? t('updateFailed') : t('updateAvailable')}
          </Text>
          {downloadError && (
            <Text style={styles.errorText}>{t('updateErrorTryAgain')}</Text>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleDownload}
          disabled={isDownloadingUpdate}
        >
          {isDownloadingUpdate ? (
            <ActivityIndicator size="small" color={colors.buttonText} />
          ) : (
            <Text style={styles.buttonText}>
              {downloadError ? t('retry') : t('updateNow')}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={dismissBanner}
          disabled={isDownloadingUpdate}
        >
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  textContainer: {
    flex: 1
  },
  text: {
    color: colors.text,
    fontSize: 14
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 2
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4
  },
  buttonText: {
    color: colors.buttonText,
    fontSize: 14,
    fontWeight: '500'
  },
  dismissButton: {
    padding: 4
  }
});
