import { colors, spacing } from '@/styles/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface InsertionCursorProps {
  visible: boolean;
  position: number; // Position in the list (0-based index)
}

const InsertionCursor: React.FC<InsertionCursorProps> = ({
  visible,
  position
}) => {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.cursorLine} />
      <View style={styles.cursorDot} />
      <View style={styles.cursorLine} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xsmall
  },
  cursorLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1
  },
  cursorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginHorizontal: spacing.xsmall
  }
});

export default InsertionCursor;
