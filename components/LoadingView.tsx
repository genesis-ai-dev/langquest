import { colors } from '@/styles/theme';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function LoadingView() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent'
  }
});
