import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import type { Href } from 'expo-router';
import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

interface SettingsItem {
  id: string;
  title: string;
  description?: string;
  type: 'toggle' | 'button' | 'link';
  value?: boolean;
  onPress?: () => void;
  href?: Href;
  disabled?: boolean;
}

export default function SettingsView() {
  const { t } = useLocalization();
  const isOnline = useNetworkStatus();

  // Centralized settings store (select individual slices to avoid broad subscriptions)
  const notificationsEnabled = useLocalStore(
    (state) => state.notificationsEnabled
  );
  const downloadOnWifiOnly = useLocalStore((state) => state.downloadOnWifiOnly);
  const autoBackup = useLocalStore((state) => state.autoBackup);
  const debugMode = useLocalStore((state) => state.debugMode);
  const showHiddenContent = useLocalStore((state) => state.showHiddenContent);

  const setShowHiddenContent = useLocalStore(
    (state) => state.setShowHiddenContent
  );
  const setNotificationsEnabled = useLocalStore(
    (state) => state.setNotificationsEnabled
  );
  const setDownloadOnWifiOnly = useLocalStore(
    (state) => state.setDownloadOnWifiOnly
  );
  const setAutoBackup = useLocalStore((state) => state.setAutoBackup);
  const setDebugMode = useLocalStore((state) => state.setDebugMode);

  // Settings are loaded from the centralized store

  const handleNotificationToggle = (value: boolean) => {
    setNotificationsEnabled(value);
    // TODO: Implement actual notification permission logic
    console.log('Notifications:', value);
  };

  const handleWifiOnlyToggle = (value: boolean) => {
    setDownloadOnWifiOnly(value);
    // TODO: Implement download preference logic
    console.log('WiFi only downloads:', value);
  };

  const handleAutoBackupToggle = (value: boolean) => {
    setAutoBackup(value);
    // TODO: Implement backup logic
    console.log('Auto backup:', value);
  };

  const handleDebugToggle = (value: boolean) => {
    setDebugMode(value);
    // TODO: Implement debug mode logic
    console.log('Debug mode:', value);
  };

  const handleShowHiddenContentToggle = (value: boolean) => {
    setShowHiddenContent(value);
  };

  const handleClearCache = () => {
    Alert.alert(t('clearCache'), t('clearCacheConfirmation'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('clear'),
        style: 'destructive',
        onPress: () => {
          // TODO: Implement cache clearing logic
          Alert.alert(t('success'), t('cacheClearedSuccess'));
        }
      }
    ]);
  };

  const handleExportData = () => {
    if (!isOnline) {
      Alert.alert(t('error'), t('exportRequiresInternet'));
      return;
    }
    // TODO: Implement data export logic
    Alert.alert(t('info'), t('exportDataComingSoon'));
  };

  const settingsSections: SettingsSection[] = [
    {
      title: t('notifications'),
      items: [
        {
          id: 'notifications',
          title: t('enableNotifications'),
          description: t('notificationsDescription'),
          type: 'toggle',
          value: notificationsEnabled,
          onPress: () => handleNotificationToggle(!notificationsEnabled)
        }
      ]
    },
    {
      title: t('contentPreferences'),
      items: [
        {
          id: 'showHiddenContent',
          title: t('showHiddenContent'),
          description: t('showHiddenContentDescription'),
          type: 'toggle',
          value: showHiddenContent,
          onPress: () => handleShowHiddenContentToggle(!showHiddenContent)
        }
      ]
    },
    {
      title: t('dataAndStorage'),
      items: [
        {
          id: 'wifiOnly',
          title: t('downloadOnWifiOnly'),
          description: t('downloadOnWifiOnlyDescription'),
          type: 'toggle',
          value: downloadOnWifiOnly,
          onPress: () => handleWifiOnlyToggle(!downloadOnWifiOnly)
        },
        {
          id: 'autoBackup',
          title: t('autoBackup'),
          description: t('autoBackupDescription'),
          type: 'toggle',
          value: autoBackup,
          onPress: () => handleAutoBackupToggle(!autoBackup),
          disabled: !isOnline
        },
        {
          id: 'clearCache',
          title: t('clearCache'),
          description: t('clearCacheDescription'),
          type: 'button',
          onPress: handleClearCache
        },
        {
          id: 'exportData',
          title: t('exportData'),
          description: t('exportDataDescription'),
          type: 'button',
          onPress: handleExportData,
          disabled: !isOnline
        }
      ]
    },
    {
      title: t('support'),
      items: [
        {
          id: 'help',
          title: t('helpCenter'),
          type: 'link',
          onPress: () => {
            Alert.alert(t('info'), t('helpCenterComingSoon'));
          }
        },
        {
          id: 'contact',
          title: t('contactSupport'),
          type: 'link',
          onPress: () => {
            // TODO: Implement contact support logic
            Alert.alert(t('info'), t('contactSupportComingSoon'));
          }
        },
        {
          id: 'terms',
          title: t('termsAndConditions'),
          type: 'link',
          onPress: () => {
            // TODO: Navigate to terms page
            Alert.alert(t('info'), t('termsAndConditionsComingSoon'));
          }
        }
      ]
    },
    {
      title: t('advanced'),
      items: [
        {
          id: 'debug',
          title: t('debugMode'),
          description: t('debugModeDescription'),
          type: 'toggle',
          value: debugMode,
          onPress: () => handleDebugToggle(!debugMode)
        }
      ]
    }
  ];

  const renderSettingsItem = (item: SettingsItem) => {
    const isDisabled = item.disabled;

    switch (item.type) {
      case 'toggle':
        return (
          <Card
            key={item.id}
            className={cn(
              isDisabled && 'opacity-50',
              'flex w-full flex-row items-center gap-2 p-6'
            )}
          >
            <CardHeader className="flex-1 p-0">
              <CardTitle>{item.title}</CardTitle>
              {item.description && (
                <CardDescription>{item.description}</CardDescription>
              )}
            </CardHeader>
            <Switch
              checked={item.value || false}
              onCheckedChange={() => item.onPress?.()}
              disabled={isDisabled}
              className={cn(!item.value && 'dark:bg-accent/60')}
            />
          </Card>
        );

      case 'button':
        return (
          <Card
            key={item.id}
            className={cn(
              isDisabled && 'opacity-50',
              'flex w-full flex-row items-center gap-2 p-6'
            )}
          >
            <TouchableOpacity
              className="flex-1 flex-row items-center"
              onPress={item.onPress}
              disabled={isDisabled}
            >
              <CardHeader className="flex-1 p-0">
                <CardTitle>{item.title}</CardTitle>
                {item.description && (
                  <CardDescription>{item.description}</CardDescription>
                )}
              </CardHeader>
            </TouchableOpacity>
          </Card>
        );

      case 'link':
        return (
          <Card
            key={item.id}
            className={cn(
              isDisabled && 'opacity-50',
              'flex w-full flex-row items-center gap-2 p-6'
            )}
          >
            <Pressable
              onPress={() => {
                // Navigate to the href
                if (item.onPress) {
                  item.onPress();
                }
              }}
              disabled={isDisabled}
            >
              <CardHeader className="flex-1 p-0">
                <CardTitle className="text-primary">{item.title}</CardTitle>
                {item.description && (
                  <CardDescription>{item.description}</CardDescription>
                )}
              </CardHeader>
            </Pressable>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <ScrollView className="p-4">
      <View className="gap-6">
        <Text className="text-2xl font-bold">{t('settings')}</Text>

        {!isOnline && (
          <View className="items-center rounded-lg bg-card p-4">
            <Text className="text-center text-muted-foreground">
              {t('settingsRequireInternet')}
            </Text>
          </View>
        )}

        {settingsSections.map((section) => (
          <View key={section.title} className="gap-4">
            <Text className="mb-2 text-lg font-bold text-foreground">
              {section.title}
            </Text>
            <View className="gap-2">
              {section.items.map(renderSettingsItem)}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
