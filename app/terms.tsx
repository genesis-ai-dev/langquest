import { LanguageSelect } from '@/components/language-select';
import { Button, OpacityPressable } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Linking, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

function Terms() {
  const router = useRouter();
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const acceptTerms = useLocalStore((state) => state.acceptTerms);
  const { t } = useLocalization();

  const handleAcceptTerms = useCallback(() => {
    console.log('Accepting terms...');
    acceptTerms();
    // After accepting terms, show the onboarding walkthrough
    // The onboarding will show automatically when navigating to projects view
    router.replace('/');
  }, [acceptTerms, router]);

  const canAcceptTerms = !dateTermsAccepted;

  return (
    <>
      <Stack.Screen options={{ title: 'Terms' }} />
      <View className="pt-safe flex flex-1 flex-col gap-4 bg-background px-4 pb-[env(safe-area-inset-bottom)]">
        <View className="w-full bg-background">
          <Text variant="h4">{t('termsAndPrivacyTitle')}</Text>
        </View>

        {/* Language Selector */}
        <View className="w-full gap-2.5">
          <LanguageSelect uiReadyOnly />
        </View>

        <ScrollView contentContainerClassName="flex flex-col gap-4 w-full">
          <Text variant="p">
            {(() => {
              // Get raw translation without replacing placeholders
              const rawText = t('termsContributionInfo');
              // Split on {iAgree} placeholder (with optional spaces)
              const placeholderRegex = /\{ *iAgree *\}/;
              const match = rawText.match(placeholderRegex);
              if (match) {
                const parts = rawText.split(placeholderRegex);
                const iAgreeText = t('iAgree');
                return (
                  <>
                    {parts[0]}
                    <Text className="text-sm font-semibold">{iAgreeText}</Text>
                    {parts[1]}
                  </>
                );
              }
              // Fallback if placeholder not found
              return rawText;
            })()}
          </Text>
          <Text variant="p">{t('termsDataInfo')}</Text>
          <Text variant="p">{t('analyticsInfo')}</Text>
        </ScrollView>

        <OpacityPressable
          onPress={() =>
            Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL}/terms`)
          }
          className="w-full justify-start"
        >
          <Text className="font-medium text-primary">{t('viewFullTerms')}</Text>
        </OpacityPressable>
        <OpacityPressable
          onPress={() =>
            Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL}/privacy`)
          }
          className="w-full justify-start"
        >
          <Text className="font-medium text-primary">
            {t('viewFullPrivacy')}
          </Text>
        </OpacityPressable>

        {canAcceptTerms && (
          <View className="w-full">
            <Button onPress={handleAcceptTerms}>
              <Text>{t('iAgree')}</Text>
            </Button>
          </View>
        )}
      </View>
    </>
  );
}

export default Terms;
