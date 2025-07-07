import { useAppNavigation } from '@/hooks/useAppNavigation';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function AppHeader({
  drawerToggleCallback
}: {
  drawerToggleCallback: () => void;
}) {
  const {
    breadcrumbs,
    canGoBack: _canGoBack,
    goBack: _goBack
  } = useAppNavigation();

  const [pressedIndex, setPressedIndex] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Back Button */}
        {/* {canGoBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={goBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )} */}

        {/* Breadcrumbs */}
        <View style={styles.breadcrumbContainer}>
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const isFirst = index === 0;

            return (
              <View key={index} style={styles.breadcrumbItem}>
                {!isFirst && (
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textSecondary}
                    style={styles.breadcrumbSeparator}
                  />
                )}

                <View
                  style={
                    isLast
                      ? styles.currentBreadcrumbTextContainer
                      : styles.breadcrumbTextContainer
                  }
                >
                  {crumb.onPress ? (
                    <Pressable
                      onPress={crumb.onPress}
                      onPressIn={() => setPressedIndex(index)}
                      onPressOut={() => setPressedIndex(null)}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      style={({ pressed }) => [
                        styles.breadcrumbTouchable,
                        pressed && styles.breadcrumbPressed
                      ]}
                    >
                      <Text
                        style={[
                          styles.breadcrumbLink,
                          pressedIndex === index && styles.breadcrumbTextPressed
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {crumb.label}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text
                      style={styles.breadcrumbCurrent}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {crumb.label}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={drawerToggleCallback}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => pressed && styles.menuButtonPressed}
        >
          <Ionicons name="menu" size={24} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54 // Standard touch target
  },
  backButton: {
    marginRight: spacing.small,
    padding: spacing.xsmall
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    overflow: 'hidden' // Prevent overflow
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1 // Allow items to shrink
  },
  breadcrumbTextContainer: {
    maxWidth: 80, // Short max width for previous breadcrumbs
    flexShrink: 1
  },
  currentBreadcrumbTextContainer: {
    maxWidth: 150, // Longer max width for current breadcrumb
    flexShrink: 1
  },
  breadcrumbTouchable: {
    flexShrink: 1,
    padding: 4,
    borderRadius: 4
  },
  breadcrumbPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Subtle white overlay
    transform: [{ scale: 0.98 }] // Slight scale down for tactile feedback
  },
  breadcrumbTextPressed: {
    opacity: 0.8 // Less opacity reduction
  },
  menuButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Match breadcrumb style
    borderRadius: 4,
    transform: [{ scale: 0.98 }]
  },
  breadcrumbSeparator: {
    marginHorizontal: spacing.xsmall,
    flexShrink: 0 // Don't shrink separators
  },
  breadcrumbLink: {
    fontSize: fontSizes.medium,
    color: colors.primary,
    fontWeight: '500'
  },
  breadcrumbCurrent: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: '600'
  },
  spacer: {
    width: 32 // Balance the back button
  }
});
