/**
 * Auth group layout. The nested Stack is ALWAYS rendered -- never conditionally
 * swapped with <Redirect>. Mounting/unmounting a navigator mid-render corrupts
 * sibling navigators' state → "Cannot read property 'stale' of undefined".
 * Each auth screen handles its own redirect via useAuth().
 */

import { cn } from '@/utils/styleUtils';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { DEFAULT_STACK_OPTIONS } from '../_layout';

export default function AuthLayout() {
  return (
    <View className={cn('flex-1 bg-background')}>
      <Stack screenOptions={DEFAULT_STACK_OPTIONS} />
    </View>
  );
}
