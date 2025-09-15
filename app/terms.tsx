import { LanguageSelect } from '@/components/language-select';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { colors, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { memo, useCallback, useState } from 'react';
import {
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

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
      className="py-safe flex-1 items-center bg-background px-4"
      onLayout={onLayoutView}
    >
      <View className="mb-4 w-full flex-row items-center justify-between">
        <Text className="flex-1 text-xl font-bold text-foreground">
          {t('termsAndPrivacyTitle')}
        </Text>
        {!canAcceptTerms && (
          <TouchableOpacity className="p-2" onPress={handleClosePress}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Language Selector */}
      <View className="mb-4 w-full gap-2.5">
        <LanguageSelect setLanguagesLoaded={setLanguagesLoaded} />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 10 }}>
        <Text className="mb-4 text-base leading-6 text-foreground">
          {t('termsContributionInfo')}
        </Text>
        <Text className="mb-4 text-base leading-6 text-foreground">
          {t('termsDataInfo')}
        </Text>
        <Text className="mb-4 text-base leading-6 text-foreground">
          {t('analyticsInfo')}
        </Text>
        <TouchableOpacity onPress={handleViewTerms} className="mt-4">
          <Text style={[sharedStyles.link]} className="text-base">
            {t('viewFullTerms')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleViewPrivacy} className="mt-4">
          <Text style={[sharedStyles.link]} className="text-base">
            {t('viewFullPrivacy')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {canAcceptTerms && (
        <>
          <View className="my-5 w-full px-2.5">
            <TouchableOpacity
              onPress={handleToggleTerms}
              className="flex-row items-center"
            >
              <Ionicons
                name={termsAccepted ? 'checkbox' : 'square-outline'}
                size={24}
                color={colors.text}
                className="mr-2.5"
              />
              <Text className="flex-1 flex-wrap text-base text-foreground">
                {t('agreeToTerms')}
              </Text>
            </TouchableOpacity>
          </View>
          <View className="mt-2.5 w-full flex-row justify-between px-2.5 pb-5">
            <TouchableOpacity
              style={[
                sharedStyles.button,
                { flex: 1 },
                !termsAccepted && { opacity: 0.5 }
              ]}
              onPress={handleAcceptTerms}
              disabled={!termsAccepted}
            >
              <Text style={sharedStyles.buttonText}>{t('accept')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

export default memo(Terms);
