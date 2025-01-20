import { useTranslation } from '@/hooks/useTranslation';
import { colors, spacing, borderRadius, fontSizes } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Modal, StyleSheet } from 'react-native';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
}

export function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const { t } = useTranslation();

  const menuItems: MenuItem[] = [
    {
      icon: 'notifications',
      label: t('notifications'),
      badge: 2,
      onPress: () => {
        setIsOpen(false);
      }
    },
    {
      icon: 'download',
      label: t('downloads'),
      onPress: () => {
        setIsOpen(false);
      }
    },
    {
      icon: 'trophy',
      label: t('leaderboard'),
      onPress: () => {
        setIsOpen(false);
      }
    },
    {
      icon: 'person',
      label: t('profile'),
      onPress: () => {
        setIsOpen(false);
      }
    },
    {
      icon: 'settings',
      label: t('settings'),
      onPress: () => {
        setIsOpen(false);
      }
    },
    {
      icon: 'exit',
      label: t('export'),
      onPress: () => {
        setIsOpen(false);
      }
    },
    {
      icon: 'log-out',
      label: t('logOut'),
      onPress: () => {
        setIsOpen(false);
      }
    }
  ];

  return (
    <>
      <TouchableOpacity
        style={styles.hamburgerButton}
        onPress={() => setIsOpen(true)}
      >
        <Ionicons name="menu" size={24} color={colors.text} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View
            style={styles.menuContainer}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuItem,
                  index === menuItems.length - 1 && styles.lastMenuItem
                ]}
                onPress={item.onPress}
              >
                <View style={styles.menuItemContent}>
                  <Ionicons name={item.icon} size={24} color={colors.text} />
                  <Text style={styles.menuItemText}>{item.label}</Text>
                </View>
                {item.badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hamburgerButton: {
    position: 'absolute',
    top: spacing.medium,
    right: spacing.medium,
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.small,
    borderRadius: borderRadius.large,
    zIndex: 1000
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  menuContainer: {
    position: 'absolute',
    top: spacing.xlarge + spacing.medium,
    right: spacing.medium,
    width: 250,
    backgroundColor: colors.background,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.medium
  },
  lastMenuItem: {
    borderBottomWidth: 0
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium
  },
  menuItemText: {
    color: colors.text,
    fontSize: fontSizes.medium
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.large,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  badgeText: {
    color: colors.text,
    fontSize: fontSizes.small,
    fontWeight: 'bold'
  }
});
