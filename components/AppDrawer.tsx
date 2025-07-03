import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useNotifications } from '@/hooks/useNotifications';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DrawerItemType {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  notificationCount?: number;
}

export default function AppDrawer({
  drawerIsVisible,
  setDrawerIsVisible
}: {
  drawerIsVisible: boolean;
  setDrawerIsVisible: (isVisible: boolean) => void;
}) {
  const { t } = useLocalization();
  const {
    goToProjects,
    goToProfile,
    goToNotifications,
    goToSettings,
    currentView
  } = useAppNavigation();

  // Use the notifications hook
  const { notificationCount } = useNotifications();

  // Feature flag to toggle notifications visibility
  const SHOW_NOTIFICATIONS = true; // Set to true to enable notifications

  const drawerItems: DrawerItemType[] = [
    {
      name: t('projects'),
      icon: 'home',
      onPress: () => {
        goToProjects();
        setDrawerIsVisible(false);
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    ...(SHOW_NOTIFICATIONS
      ? [
          {
            name: t('notifications'),
            icon: 'notifications' as keyof typeof Ionicons.glyphMap,
            onPress: () => {
              goToNotifications();
              setDrawerIsVisible(false);
            },
            notificationCount
          }
        ]
      : []),
    {
      name: t('profile'),
      icon: 'person',
      onPress: () => {
        goToProfile();
        setDrawerIsVisible(false);
      }
    },
    {
      name: t('settings'),
      icon: 'settings',
      onPress: () => {
        goToSettings();
        setDrawerIsVisible(false);
      }
    }
  ] as const;

  const closeDrawer = () => {
    setDrawerIsVisible(false);
  };

  return (
    <>
      {/* Drawer Modal */}
      <Modal
        visible={drawerIsVisible}
        transparent
        animationType="slide"
        onRequestClose={closeDrawer}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={closeDrawer}
          />

          <View style={styles.drawerContainer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>{t('menu')}</Text>
              <TouchableOpacity
                onPress={closeDrawer}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.drawerContent}>
              {drawerItems.map((item, index) => {
                const isActive =
                  currentView === 'projects' &&
                  item.name.toLowerCase() === t('projects').toLowerCase();

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.drawerItem,
                      isActive && styles.drawerItemActive
                    ]}
                    onPress={item.onPress}
                  >
                    <View style={styles.drawerItemContent}>
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={colors.text}
                      />
                      <Text style={styles.drawerItemText}>{item.name}</Text>
                      {item.notificationCount
                        ? item.notificationCount > 0 && (
                            <View style={styles.notificationBadge}>
                              <Text style={styles.notificationText}>
                                {item.notificationCount > 99
                                  ? '99+'
                                  : item.notificationCount}
                              </Text>
                            </View>
                          )
                        : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
      {/* Drawer Toggle Button
      <TouchableOpacity
        style={styles.drawerToggle}
        onPress={toggleDrawer}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="menu" size={24} color={colors.text} />
      </TouchableOpacity> */}
    </>
  );
}

const styles = StyleSheet.create({
  drawerToggle: {
    position: 'absolute',
    top: spacing.medium,
    left: spacing.medium,
    zIndex: 1000,
    padding: spacing.small,
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  overlayTouchable: {
    flex: 1
  },
  drawerContainer: {
    backgroundColor: colors.inputBackground,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    maxHeight: '80%'
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.textSecondary
  },
  drawerTitle: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    color: colors.text
  },
  drawerContent: {
    padding: spacing.medium
  },
  drawerItem: {
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.medium,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.small
  },
  drawerItemActive: {
    backgroundColor: colors.primary + '20' // 20% opacity
  },
  drawerItemContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  drawerItemText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginLeft: spacing.medium,
    flex: 1
  },
  notificationBadge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6
  },
  notificationText: {
    fontSize: fontSizes.xsmall,
    color: '#FFFFFF',
    fontWeight: '600'
  }
});
