import { LanguageSelect } from '@/components/language-select';
import { Button, OpacityPressable } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ArrowLeftIcon, XIcon } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
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
    router.navigate('/');
  }, [acceptTerms, router]);

  const handleClosePress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  const canAcceptTerms = !dateTermsAccepted;

  const [languagesLoaded, setLanguagesLoaded] = useState(false);
  const onLayoutView = useCallback(() => {
    if (languagesLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [languagesLoaded]);

  return (
    <View
      // className="my-safe flex-col items-center gap-4 p-4"
      className="flex flex-1 flex-col gap-4 bg-background px-4 pb-[env(safe-area-inset-bottom)] pt-[calc(env(safe-area-inset-top)+1rem)]"
      onLayout={onLayoutView}
    >
      <View className="w-full flex-row items-center justify-between gap-2 bg-background">
        {router.canGoBack() && dateTermsAccepted && (
          <Button size="icon" variant="ghost" onPress={handleClosePress}>
            <Icon as={ArrowLeftIcon} className="size-6" />
          </Button>
        )}
        <Text variant="h4" className="flex-1">
          {t('termsAndPrivacyTitle')}
        </Text>
        {!router.canGoBack() && (
          <Button size="icon" variant="ghost" onPress={handleClosePress}>
            <Icon as={XIcon} className="size-6" />
          </Button>
        )}
      </View>

      {/* Language Selector */}
      <View className="w-full gap-2.5">
        <LanguageSelect setLanguagesLoaded={setLanguagesLoaded} uiReadyOnly />
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

      <View className="flex w-full flex-1 flex-col gap-2">
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
    </View>
  );
}

export default Terms;
