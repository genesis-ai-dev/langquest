import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import type { Href } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, TouchableOpacity, View } from 'react-native';

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
  const { goToProjects } = useAppNavigation();
  const isOnline = useNetworkStatus();

  // Centralized settings store (select individual slices to avoid broad subscriptions)
  const notificationsEnabled = useLocalStore(
    (state) => state.notificationsEnabled
  );
  const downloadOnWifiOnly = useLocalStore((state) => state.downloadOnWifiOnly);
  const autoBackup = useLocalStore((state) => state.autoBackup);
  const debugMode = useLocalStore((state) => state.debugMode);
  const showHiddenContent = useLocalStore((state) => state.showHiddenContent);
  const enableAiSuggestions = useLocalStore(
    (state) => state.enableAiSuggestions
  );
  // const enablePlayAll = useLocalStore((state) => state.enablePlayAll);
  const enableQuestExport = useLocalStore((state) => state.enableQuestExport);
  const enableVerseMarkers = useLocalStore((state) => state.enableVerseMarkers);
  const enableTranscription = useLocalStore(
    (state) => state.enableTranscription
  );
  const enableLanguoidLinkSuggestions = useLocalStore(
    (state) => state.enableLanguoidLinkSuggestions
  );

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
  const setEnableAiSuggestions = useLocalStore(
    (state) => state.setEnableAiSuggestions
  );
  // const setEnablePlayAll = useLocalStore((state) => state.setEnablePlayAll);
  const setEnableQuestExport = useLocalStore(
    (state) => state.setEnableQuestExport
  );
  const setEnableVerseMarkers = useLocalStore(
    (state) => state.setEnableVerseMarkers
  );
  const setEnableTranscription = useLocalStore(
    (state) => state.setEnableTranscription
  );
  const setEnableLanguoidLinkSuggestions = useLocalStore(
    (state) => state.setEnableLanguoidLinkSuggestions
  );

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

  const handleAiSuggestionsToggle = (value: boolean) => {
    setEnableAiSuggestions(value);
  };

  // const handlePlayAllToggle = (value: boolean) => {
  //   setEnablePlayAll(value);
  // };
  const handleQuestExportToggle = (value: boolean) => {
    setEnableQuestExport(value);
    console.log('Quest export:', value);
  };

  const handleVerseMarkersToggle = (value: boolean) => {
    setEnableVerseMarkers(value);
  };

  const handleTranscriptionToggle = (value: boolean) => {
    setEnableTranscription(value);
  };

  const handleLanguoidLinkSuggestionsToggle = (value: boolean) => {
    setEnableLanguoidLinkSuggestions(value);
  };

  const handleClearCache = () => {
    RNAlert.alert(t('clearCache'), t('clearCacheConfirmation'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('clear'),
        style: 'destructive',
        onPress: () => {
          // TODO: Implement cache clearing logic
          RNAlert.alert(t('success'), t('cacheClearedSuccess'));
        }
      }
    ]);
  };

  const handleExportData = () => {
    if (!isOnline) {
      RNAlert.alert(t('error'), t('exportRequiresInternet'));
      return;
    }
    // TODO: Implement data export logic
    RNAlert.alert(t('info'), t('exportDataComingSoon'));
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
            RNAlert.alert(t('info'), t('helpCenterComingSoon'));
          }
        },
        {
          id: 'contact',
          title: t('contactSupport'),
          type: 'link',
          onPress: () => {
            // TODO: Implement contact support logic
            RNAlert.alert(t('info'), t('contactSupportComingSoon'));
          }
        },
        {
          id: 'terms',
          title: t('termsAndConditions'),
          type: 'link',
          onPress: () => {
            // TODO: Navigate to terms page
            RNAlert.alert(t('info'), t('termsAndConditionsComingSoon'));
          }
        }
      ]
    },
    {
      title: t('experimentalFeatures'),
      items: [
        {
          id: 'aiSuggestions',
          title: t('aiSuggestions'),
          description: t('aiSuggestionsDescription'),
          type: 'toggle',
          value: enableAiSuggestions,
          onPress: () => handleAiSuggestionsToggle(!enableAiSuggestions)
        },
        // {
        //   id: 'playAll',
        //   title: t('playAll'),
        //   description: t('playAllDescription'),
        //   type: 'toggle',
        //   value: enablePlayAll,
        //   onPress: () => handlePlayAllToggle(!enablePlayAll)
        // },
        {
          id: 'questExport',
          title: t('questExport'),
          description: t('questExportDescription'),
          type: 'toggle',
          value: enableQuestExport,
          onPress: () => handleQuestExportToggle(!enableQuestExport),
          disabled: !isOnline
        },
        {
          id: 'verseMarkers',
          title: t('verseMarkers'),
          description: t('verseMarkersDescription'),
          type: 'toggle',
          value: enableVerseMarkers,
          onPress: () => handleVerseMarkersToggle(!enableVerseMarkers)
        },
        {
          id: 'transcription',
          title: t('transcription'),
          description: t('transcriptionDescription'),
          type: 'toggle',
          value: enableTranscription,
          onPress: () => handleTranscriptionToggle(!enableTranscription)
        },
        {
          id: 'languoidLinkSuggestions',
          title: t('enableLanguoidLinkSuggestions'),
          description: t('enableLanguoidLinkSuggestionsDescription'),
          type: 'toggle',
          value: enableLanguoidLinkSuggestions,
          onPress: () =>
            handleLanguoidLinkSuggestionsToggle(!enableLanguoidLinkSuggestions),
          disabled: !isOnline
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
              <CardDescription>{item.description}</CardDescription>
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
                <CardDescription>{item.description}</CardDescription>
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
                <CardDescription>{item.description}</CardDescription>
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
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold">{t('settings')}</Text>
          <Button variant="default" size="icon-lg" onPress={goToProjects}>
            <Icon name="house" className="text-primary-foreground" />
          </Button>
        </View>

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
