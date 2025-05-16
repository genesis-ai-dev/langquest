import { useExpoUpdates } from '@/hooks/useExpoUpdates';
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
  const { updateAvailable, checkingForUpdate, downloadAndReloadUpdate } =
    useExpoUpdates();

  if (!updateAvailable) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons
          name="cloud-download-outline"
          size={20}
          color={colors.primary}
        />
        <Text style={styles.text}>A new update is available!</Text>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={() => downloadAndReloadUpdate()}
        disabled={checkingForUpdate}
      >
        {checkingForUpdate ? (
          <ActivityIndicator size="small" color={colors.buttonText} />
        ) : (
          <Text style={styles.buttonText}>Update Now</Text>
        )}
      </TouchableOpacity>
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
    gap: 8
  },
  text: {
    color: colors.text,
    fontSize: 14
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
  }
});
