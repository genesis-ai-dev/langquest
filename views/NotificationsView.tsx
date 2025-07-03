import { colors, fontSizes, spacing } from '@/styles/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function NotificationsView() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Notifications View - Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.medium
  },
  text: {
    fontSize: fontSizes.large,
    color: colors.text,
    textAlign: 'center'
  }
});
