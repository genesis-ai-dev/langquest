import { Button, OpacityPressable } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Linking, ScrollView, View } from 'react-native';

interface TermsViewProps {
  onAccept?: () => void;
  onDismiss?: () => void;
  languageSelect?: React.ReactNode;
}

export function TermsView({
  onAccept,
  onDismiss,
  languageSelect
}: TermsViewProps) {
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const acceptTerms = useLocalStore((state) => state.acceptTerms);
  const { t } = useLocalization();

  const canAcceptTerms = !dateTermsAccepted;

  return (
    <TermsViewInner
      canAcceptTerms={canAcceptTerms}
      acceptTerms={acceptTerms}
      onAccept={onAccept}
      onDismiss={onDismiss}
      languageSelect={languageSelect}
      t={t}
    />
  );
}

/**
 * Routed wrapper — used by route files that have expo-router context.
 * Calls useRouter() and wires up default accept/dismiss behavior.
 */
export function RoutedTermsView({
  languageSelect
}: Pick<TermsViewProps, 'languageSelect'> = {}) {
  const router = useRouter();

  const handleAccept = useCallback(() => {
    router.replace('/');
  }, [router]);

  const handleDismiss = useCallback(() => {
    router.dismiss();
  }, [router]);

  return (
    <TermsView
      onAccept={handleAccept}
      onDismiss={handleDismiss}
      languageSelect={languageSelect}
    />
  );
}

interface TermsViewInnerProps {
  canAcceptTerms: boolean;
  acceptTerms: () => void;
  onAccept?: () => void;
  onDismiss?: () => void;
  languageSelect?: React.ReactNode;
  t: (key: any, options?: any) => string;
}

function TermsViewInner({
  canAcceptTerms,
  acceptTerms,
  onAccept,
  onDismiss,
  languageSelect,
  t
}: TermsViewInnerProps) {
  const handleAcceptTerms = useCallback(() => {
    acceptTerms();
    onAccept?.();
  }, [acceptTerms, onAccept]);

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  return (
    <View className="flex-1 bg-background">
      <View className="shrink-0 gap-4 bg-background px-4 pt-8">
        <View className="w-full flex-row items-center justify-between">
          <Text variant="h4" className="flex-1">
            {t('termsAndPrivacyTitle')}
          </Text>
        </View>
        {languageSelect && (
          <View className="w-full gap-2.5">{languageSelect}</View>
        )}
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
      </ScrollView>
    </View>
  );
}
