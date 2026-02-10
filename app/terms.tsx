import { LanguageSelect } from '@/components/language-select';
import {
  Button,
  ButtonPressableOpacity,
  buttonTextVariants
} from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

function Terms() {
  const router = useRouter();
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const acceptTerms = useLocalStore((state) => state.acceptTerms);
  const { t } = useLocalization();
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleAcceptTerms = useCallback(() => {
    console.log('Accepting terms...');
    acceptTerms();
    // After accepting terms, show the onboarding walkthrough
    // The onboarding will show automatically when navigating to projects view
    router.navigate('/');
  }, [acceptTerms, router]);

  const handleToggleTerms = useCallback(() => {
    setTermsAccepted(!termsAccepted);
  }, [termsAccepted]);

  const handleClosePress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  const handleViewTerms = useCallback(() => {
    void Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL}/terms`);
  }, []);

  const handleViewPrivacy = useCallback(() => {
    void Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL}/privacy`);
  }, []);

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
      className="py-safe flex flex-1 flex-col gap-4 bg-background px-4"
      onLayout={onLayoutView}
    >
      <View className="w-full flex-row items-center justify-between gap-2 bg-background">
        {router.canGoBack() && (
          <Button size="icon" variant="ghost" onPress={handleClosePress}>
            <Icon name="arrow-left" className="size-6" />
          </Button>
        )}
        <Text variant="h4" className="flex-1">
          {t('termsAndPrivacyTitle')}
        </Text>
        {!router.canGoBack() && (
          <Button size="icon" variant="ghost" onPress={handleClosePress}>
            <Icon name="x" className="size-6" />
          </Button>
        )}
      </View>

      {/* Language Selector */}
      <View className="w-full gap-2.5">
        <LanguageSelect setLanguagesLoaded={setLanguagesLoaded} uiReadyOnly />
      </View>

      <ScrollView contentContainerClassName="flex flex-col gap-4">
        <Text variant="p">{t('termsContributionInfo')}</Text>
        <Text variant="p">{t('termsDataInfo')}</Text>
        <Text variant="p">{t('analyticsInfo')}</Text>
        <View className="flex flex-col gap-2">
          <ButtonPressableOpacity onPress={handleViewTerms}>
            <Text className={cn(buttonTextVariants({ variant: 'link' }))}>
              {t('viewFullTerms')}
            </Text>
          </ButtonPressableOpacity>
          <ButtonPressableOpacity onPress={handleViewPrivacy}>
            <Text className={cn(buttonTextVariants({ variant: 'link' }))}>
              {t('viewFullPrivacy')}
            </Text>
          </ButtonPressableOpacity>
        </View>
      </ScrollView>

      {canAcceptTerms && (
        <View className="flex flex-col gap-2">
          <Pressable
            className={cn(
              'flex w-full flex-row items-center gap-3 rounded-lg border border-primary bg-primary/5 px-4 py-3',
              termsAccepted ? 'border-primary bg-primary/10' : 'border-border'
            )}
            onPress={handleToggleTerms}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: termsAccepted }}
            accessibilityLabel={t('agreeToTerms')}
          >
            <Checkbox
              checked={termsAccepted}
              onCheckedChange={handleToggleTerms}
              className="shrink-0 scale-125 border-primary"
              indicatorClassName="bg-primary"
              iconClassName="text-primary-foreground"
            />
            <View className="min-w-0 flex-1 flex-shrink">
              <Label
                className={cn(
                  'text-base font-semibold',
                  termsAccepted ? 'text-primary' : 'text-foreground'
                )}
              >
                {t('agreeToTerms')}
              </Label>
            </View>
          </Pressable>
          <Button onPress={handleAcceptTerms} disabled={!termsAccepted}>
            <Text>{t('accept')}</Text>
          </Button>
        </View>
      )}
    </View>
  );
}

export default Terms;
