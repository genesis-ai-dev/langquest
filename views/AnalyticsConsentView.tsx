import {
  AnalyticsConsentCard,
  AnalyticsConsentControls
} from '@/components/AnalyticsConsentCard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { saveAnalyticsPreference } from '@/services/accountPreferences';
import React, { useCallback } from 'react';
import { ScrollView, View } from 'react-native';

interface AnalyticsConsentViewProps {
  onComplete?: () => void;
}

export function AnalyticsConsentView({
  onComplete
}: AnalyticsConsentViewProps) {
  const { t } = useLocalization();
  const [optedIn, setOptedIn] = React.useState(false);

  const handleContinue = useCallback(() => {
    saveAnalyticsPreference(optedIn);
    onComplete?.();
  }, [onComplete, optedIn]);

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="min-h-full flex-grow flex-col justify-end px-6 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <AnalyticsConsentCard
            optedIn={optedIn}
            onOptedInChange={setOptedIn}
            showControls={false}
          />
          <View className="mt-24 gap-4">
            <AnalyticsConsentControls
              optedIn={optedIn}
              onOptedInChange={setOptedIn}
            />
            <Button onPress={handleContinue}>
              <Text>{t('analyticsConsentContinue')}</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
