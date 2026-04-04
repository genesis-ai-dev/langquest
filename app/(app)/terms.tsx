import { RoutedTermsView } from '@/views/TermsView';
import { Stack } from 'expo-router';
import React from 'react';
import { DEFAULT_STACK_OPTIONS } from '../_layout';

export default function TermsFormSheetRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          ...DEFAULT_STACK_OPTIONS
          // ...FORM_SHEET_OPTIONS
        }}
      />
      <RoutedTermsView />
    </>
  );
}
