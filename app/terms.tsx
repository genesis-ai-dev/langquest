import { LanguageSelect } from '@/components/language-select';
import { Button, ButtonPressable, OpacityPressable } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { Stack, useRouter } from 'expo-router';
import { XIcon } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { Linking, Platform, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

function Terms() {
  const router = useRouter();
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const acceptTerms = useLocalStore((state) => state.acceptTerms);
  const { t } = useLocalization();

  const handleAcceptTerms = useCallback(() => {
    console.log('Accepting terms...');
    acceptTerms();
    router.dismiss();
  }, [acceptTerms, router]);

  const canAcceptTerms = !dateTermsAccepted;

  return (
    <>
      <Stack.Screen options={{ title: 'Terms' }} />
      <View className="android:pt-[calc(env(safe-area-inset-top)+1rem)] android:pb-[calc(env(safe-area-inset-bottom)+1rem)] flex flex-1 flex-col bg-background">
        <View collapsable={false} className="gap-4 bg-background px-4 pt-8">
          <View className="w-full flex-row items-center justify-between">
            <Text variant="h4" className="flex-1">
              {t('termsAndPrivacyTitle')}
            </Text>
            {!canAcceptTerms && Platform.OS === 'android' && (
              <ButtonPressable onPress={() => router.dismiss()} hitSlop={10}>
                <Icon as={XIcon} size={24} className="text-muted-foreground" />
              </ButtonPressable>
            )}
          </View>
          <View className="w-full gap-2.5">
            <LanguageSelect uiReadyOnly />
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="flex flex-col gap-4 w-full px-4 py-4 pb-8"
        >
          <Text variant="p">
            {(() => {
              const rawText = t('termsContributionInfo');
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
              return rawText;
            })()}
          </Text>
          <Text variant="p">{t('termsDataInfo')}</Text>
          <Text variant="p">{t('analyticsInfo')}</Text>

          <OpacityPressable
            onPress={() =>
              Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL}/terms`)
            }
            className="w-full justify-start"
          >
            <Text className="font-medium text-primary">
              {t('viewFullTerms')}
            </Text>
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
        </ScrollView>
      </View>
    </>
  );
}

export default Terms;
