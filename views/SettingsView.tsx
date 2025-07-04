import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { colors, spacing } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  href?: string;
  disabled?: boolean;
}

export default function SettingsView() {
  const { t } = useLocalization();
  const isOnline = useNetworkStatus();

  // Local state for settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [downloadOnWifiOnly, setDownloadOnWifiOnly] = useState(true);
  const [autoBackup, setAutoBackup] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

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

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear all cached data?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement cache clearing logic
            console.log('Clearing cache...');
            Alert.alert('Success', 'Cache cleared successfully');
          }
        }
      ]
    );
  };

  const handleExportData = () => {
    if (!isOnline) {
      Alert.alert('Error', 'This feature requires an internet connection');
      return;
    }
    // TODO: Implement data export logic
    console.log('Exporting data...');
    Alert.alert('Info', 'Data export feature coming soon');
  };

  const settingsSections: SettingsSection[] = [
    {
      title: 'Notifications',
      items: [
        {
          id: 'notifications',
          title: 'Enable Notifications',
          description:
            'Receive notifications for app updates and important information',
          type: 'toggle',
          value: notificationsEnabled,
          onPress: () => handleNotificationToggle(!notificationsEnabled)
        }
      ]
    },
    {
      title: 'Data & Storage',
      items: [
        {
          id: 'wifiOnly',
          title: 'Download on WiFi Only',
          description: 'Only download content when connected to WiFi',
          type: 'toggle',
          value: downloadOnWifiOnly,
          onPress: () => handleWifiOnlyToggle(!downloadOnWifiOnly)
        },
        {
          id: 'autoBackup',
          title: 'Auto Backup',
          description: 'Automatically backup your data to the cloud',
          type: 'toggle',
          value: autoBackup,
          onPress: () => handleAutoBackupToggle(!autoBackup),
          disabled: !isOnline
        },
        {
          id: 'clearCache',
          title: 'Clear Cache',
          description: 'Clear all cached data to free up storage space',
          type: 'button',
          onPress: handleClearCache
        },
        {
          id: 'exportData',
          title: 'Export Data',
          description: 'Export your data for backup or transfer',
          type: 'button',
          onPress: handleExportData,
          disabled: !isOnline
        }
      ]
    },
    {
      title: 'Support',
      items: [
        {
          id: 'help',
          title: 'Help Center',
          type: 'button',
          onPress: () => {
            Alert.alert('Info', 'Help center feature coming soon');
          }
        },
        {
          id: 'contact',
          title: 'Contact Support',
          type: 'button',
          onPress: () => {
            // TODO: Implement contact support logic
            Alert.alert('Info', 'Contact support feature coming soon');
          }
        },
        {
          id: 'terms',
          title: 'Terms & Conditions',
          type: 'button',
          onPress: () => {
            // TODO: Navigate to terms page
            Alert.alert('Info', 'Terms & Conditions feature coming soon');
          }
        }
      ]
    },
    {
      title: 'Advanced',
      items: [
        {
          id: 'debug',
          title: 'Debug Mode',
          description: 'Enable debug mode for development features',
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
          <View
            key={item.id}
            style={[
              styles.settingItem,
              isDisabled && styles.settingItemDisabled
            ]}
          >
            <View style={styles.settingContent}>
              <Text
                style={[styles.settingTitle, isDisabled && styles.disabledText]}
              >
                {item.title}
              </Text>
              {item.description && (
                <Text
                  style={[
                    styles.settingDescription,
                    isDisabled && styles.disabledText
                  ]}
                >
                  {item.description}
                </Text>
              )}
            </View>
            <Switch
              value={item.value || false}
              onValueChange={item.onPress}
              disabled={isDisabled}
              trackColor={{
                false: colors.textSecondary,
                true: colors.primary // Use primary color for better contrast
              }}
              thumbColor={item.value ? colors.primary : colors.inputBackground} // Different thumb colors for on/off states
            />
          </View>
        );

      case 'button':
        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.settingItem,
              isDisabled && styles.settingItemDisabled
            ]}
            onPress={item.onPress}
            disabled={isDisabled}
          >
            <View style={styles.settingContent}>
              <Text
                style={[styles.settingTitle, isDisabled && styles.disabledText]}
              >
                {item.title}
              </Text>
              {item.description && (
                <Text
                  style={[
                    styles.settingDescription,
                    isDisabled && styles.disabledText
                  ]}
                >
                  {item.description}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );

      case 'link':
        if (item.href) {
          return (
            <Link key={item.id} href={item.href} asChild>
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{item.title}</Text>
                  {item.description && (
                    <Text style={styles.settingDescription}>
                      {item.description}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </Link>
          );
        }
        return null;

      default:
        return null;
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView style={styles.container}>
          <View style={styles.contentContainer}>
            <Text style={styles.pageTitle}>{t('settings')}</Text>

            {!isOnline && (
              <View style={styles.offlineMessage}>
                <Text style={styles.offlineText}>
                  Some settings require an internet connection
                </Text>
              </View>
            )}

            {settingsSections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionContent}>
                  {section.items.map(renderSettingsItem)}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.medium
  },
  contentContainer: {
    gap: spacing.large
  },
  offlineMessage: {
    backgroundColor: colors.inputBackground,
    padding: spacing.medium,
    borderRadius: 8,
    alignItems: 'center'
  },
  offlineText: {
    color: colors.textSecondary,
    textAlign: 'center'
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.large
  },
  section: {
    gap: spacing.small
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.small
  },
  sectionContent: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    overflow: 'hidden'
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.medium,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.inputBorder
  },
  settingItemDisabled: {
    opacity: 0.5
  },
  settingContent: {
    flex: 1,
    marginRight: spacing.medium
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.tiny
  },
  settingDescription: {
    fontSize: 14,
    color: colors.textSecondary
  },
  disabledText: {
    color: colors.textSecondary
  }
});
