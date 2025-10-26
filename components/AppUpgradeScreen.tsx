/**
 * App Upgrade Screen
 *
 * Fullscreen blocking UI shown when app version is incompatible with server schema.
 * Provides information about version mismatch and directs user to upgrade.
 *
 * Flow:
 * 1. Displayed when AuthContext detects AppUpgradeNeededError
 * 2. Shows current vs required version
 * 3. Provides upgrade instructions based on platform
 * 4. Cannot be dismissed - app cannot proceed without upgrade
 */

import { useLocalization } from '@/hooks/useLocalization';
import React from 'react';
import { Linking, Platform, View } from 'react-native';
import { Button } from './ui/button';
import { Text } from './ui/text';

interface AppUpgradeScreenProps {
  localVersion: string;
  serverVersion: string;
  reason: 'server_ahead' | 'server_behind';
}

export function AppUpgradeScreen({
  localVersion,
  serverVersion,
  reason
}: AppUpgradeScreenProps) {
  const { t } = useLocalization();

  const handleUpgrade = async () => {
    // Direct user to appropriate app store based on platform
    try {
      if (Platform.OS === 'ios') {
        // Replace with your actual App Store URL
        await Linking.openURL('https://apps.apple.com/app/your-app-id');
      } else if (Platform.OS === 'android') {
        // Replace with your actual Play Store URL
        await Linking.openURL(
          'https://play.google.com/store/apps/details?id=your.package.name'
        );
      } else {
        // For web, reload the page to get latest version
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('[AppUpgradeScreen] Failed to open store:', error);
    }
  };

  const getMessage = () => {
    if (reason === 'server_ahead') {
      return t('appUpgradeServerAhead');
    } else {
      return t('appUpgradeServerBehind');
    }
  };

  const showUpgradeButton = reason === 'server_ahead';

  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <View className="w-full max-w-md space-y-6">
        {/* Icon/Warning */}
        <View className="items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
            <Text className="text-4xl">⚠️</Text>
          </View>
        </View>

        {/* Title */}
        <View className="items-center space-y-2">
          <Text className="text-center text-2xl font-bold">
            {t('appUpgradeRequired')}
          </Text>
          <Text className="text-center text-muted-foreground">
            {getMessage()}
          </Text>
        </View>

        {/* Version Information */}
        <View className="space-y-3 rounded-lg border border-border bg-card p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-medium text-muted-foreground">
              {t('currentVersion')}
            </Text>
            <Text className="font-mono text-lg font-bold">{localVersion}</Text>
          </View>

          <View className="h-px bg-border" />

          <View className="flex-row items-center justify-between">
            <Text className="font-medium text-muted-foreground">
              {t('requiredVersion')}
            </Text>
            <Text className="font-mono text-lg font-bold text-primary">
              {serverVersion}
            </Text>
          </View>
        </View>

        {/* Upgrade Button (only shown when server is ahead) */}
        {showUpgradeButton && (
          <View className="space-y-3">
            <Button
              onPress={handleUpgrade}
              className="w-full"
              variant="default"
              size="lg"
            >
              <Text className="font-semibold text-primary-foreground">
                {t('upgradeApp')}
              </Text>
            </Button>

            <Text className="text-center text-xs text-muted-foreground">
              {t('upgradeToVersion', { version: serverVersion })}
            </Text>
          </View>
        )}

        {/* Info for server behind scenario */}
        {!showUpgradeButton && (
          <View className="rounded-lg border border-border bg-muted/50 p-4">
            <Text className="text-center text-sm text-muted-foreground">
              {t('contactSupport')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
