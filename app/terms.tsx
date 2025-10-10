import { LanguageSelect } from '@/components/language-select';
import { Button, buttonTextVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { XIcon } from 'lucide-react-native';
import React, { memo, useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

function Terms() {
  const router = useRouter();
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const acceptTerms = useLocalStore((state) => state.acceptTerms);
  const { t } = useLocalization();
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleAcceptTerms = useCallback(() => {
    console.log('Accepting terms...');
    acceptTerms();
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
      className="my-safe flex-1 items-center gap-4 bg-background p-4"
      onLayout={onLayoutView}
    >
      <View className="w-full flex-row items-center justify-between">
        <Text variant="h4">{t('termsAndPrivacyTitle')}</Text>
        {!canAcceptTerms && (
          <Button size="icon" variant="ghost" onPress={handleClosePress}>
            <Icon as={XIcon} />
          </Button>
        )}
      </View>

      {/* Language Selector */}
      <View className="w-full gap-2.5">
        <LanguageSelect setLanguagesLoaded={setLanguagesLoaded} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="flex flex-col gap-3 pb-4"
      >
        <Text variant="p">{t('termsContributionInfo')}</Text>
        <Text variant="p">{t('termsDataInfo')}</Text>
        <Text variant="p">{t('analyticsInfo')}</Text>
        <View className="flex flex-col gap-2">
          <Pressable onPress={handleViewTerms}>
            <Text className={cn(buttonTextVariants({ variant: 'link' }))}>
              {t('viewFullTerms')}
            </Text>
          </Pressable>
          <Pressable onPress={handleViewPrivacy}>
            <Text className={cn(buttonTextVariants({ variant: 'link' }))}>
              {t('viewFullPrivacy')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {canAcceptTerms && (
        <View className="flex w-full flex-col gap-3 pt-2">
          <Pressable
            onPress={handleToggleTerms}
            className="flex w-full flex-row items-start gap-2.5 rounded-lg border border-border bg-card p-4"
          >
            <Checkbox
              checked={termsAccepted}
              onCheckedChange={handleToggleTerms}
            />
            <Text className="flex-1 text-base leading-relaxed text-foreground">
              {t('agreeToTerms')}
            </Text>
          </Pressable>
          <Button onPress={handleAcceptTerms} disabled={!termsAccepted}>
            <Text>{t('accept')}</Text>
          </Button>
        </View>
      )}
    </View>
  );
}

export default memo(Terms);
