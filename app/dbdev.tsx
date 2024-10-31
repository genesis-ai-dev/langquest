import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/theme';
import { DevTableView } from '@/db_dev_view_components/DevTableView';

export default function DbDev() {
  return (
    <LinearGradient 
      colors={[colors.gradientStart, colors.gradientEnd]} 
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <DevTableView />
      </SafeAreaView>
    </LinearGradient>
  );
} 