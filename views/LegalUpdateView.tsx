import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, OpacityPressable } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  CURRENT_LEGAL_VERSION,
  formatLegalVersionDate
} from '@/constants/legalVersions';
import { useLocalization } from '@/hooks/useLocalization';
import { syncLegalAcceptanceToAccount } from '@/services/legalAcceptance';
import { useLocalStore } from '@/store/localStore';
import { openLegalUrl } from '@/utils/openLegalUrl';
import { InfoIcon } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LegalUpdateViewProps {
  onAccept?: () => void;
}

export function LegalUpdateView({ onAccept }: LegalUpdateViewProps) {
  const acceptTerms = useLocalStore((state) => state.acceptTerms);
  const { t } = useLocalization();

  const handleAccept = useCallback(() => {
    const acceptedAt = new Date();
    acceptTerms({ subjectToLegalEffectiveDateWait: true });
    void syncLegalAcceptanceToAccount(acceptedAt.toISOString());
    onAccept?.();
  }, [acceptTerms, onAccept]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="shrink-0 gap-4 bg-background px-4 pt-4">
        <Text variant="h4">{t('legalUpdateTitle')}</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="flex flex-col gap-4 w-full px-4 pt-4 pb-10"
      >
        <Alert icon={InfoIcon}>
          <AlertTitle>{t('legalUpdateAlertTitle')}</AlertTitle>
          <AlertDescription>
            {t('legalUpdateIntro', {
              effectiveDate: formatLegalVersionDate(CURRENT_LEGAL_VERSION)
            })}
          </AlertDescription>
        </Alert>

        <Text variant="p">{t('legalUpdateSummary')}</Text>
        <Text variant="p">{t('legalUpdateAnalytics')}</Text>
        <Text variant="p">{t('legalUpdateAnalyticsNext')}</Text>
        <Text variant="p">
          {t('legalUpdateAcknowledgement', {
            agreeButton: t('legalUpdateAgree')
          })}
        </Text>

        <OpacityPressable
          onPress={() => void openLegalUrl('privacy')}
          className="w-full justify-start"
        >
          <Text className="font-medium text-primary">
            {t('viewFullPrivacy')}
          </Text>
        </OpacityPressable>
        <OpacityPressable
          onPress={() => void openLegalUrl('privacy-archive')}
          className="w-full justify-start"
        >
          <Text className="font-medium text-primary">
            {t('viewPrivacyArchive')}
          </Text>
        </OpacityPressable>

        <View className="w-full">
          <Button onPress={handleAccept}>
            <Text>{t('legalUpdateAgree')}</Text>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
