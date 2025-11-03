import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/database_services/profileService';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { getNetworkStatus, useNetworkStatus } from '@/hooks/useNetworkStatus';
import { resetDatabase } from '@/utils/dbUtils';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, HomeIcon, InfoIcon } from 'lucide-react-native';
import { useState } from 'react';
import {
  Linking,
  Pressable,
  Alert as RNAlert,
  ScrollView,
  View
} from 'react-native';

export default function AccountDeletionView() {
  const { t } = useLocalization();
  const { currentUser, signOut } = useAuth();
  const { goToProjects, goBack } = useAppNavigation();
  const isOnline = useNetworkStatus();
  const [step, setStep] = useState<1 | 2>(1);

  const { mutateAsync: deleteAccount, isPending } = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) {
        throw new Error('No user ID found');
      }

      // Check network status inside mutation (not closure value)
      if (!getNetworkStatus()) {
        throw new Error(t('accountDeletionRequiresOnline'));
      }

      // 1. Anonymize profile in Supabase (removes PII but keeps profile record)
      await profileService.deleteAccount(currentUser.id);

      // 2. Reset local database
      await resetDatabase();

      // 3. Sign out user (this will trigger system cleanup via AuthContext)
      await signOut();
    },
    onSuccess: () => {
      RNAlert.alert(
        t('success'),
        t('accountDeletionSuccess'),
        [
          {
            text: t('done'),
            onPress: () => {
              // Navigate will happen automatically via auth state change
            }
          }
        ],
        { cancelable: false }
      );
    },
    onError: (error) => {
      console.error('Error deleting account:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      RNAlert.alert(
        t('error'),
        t('accountDeletionError', { error: errorMessage })
      );
    }
  });

  const handleContinue = () => {
    if (step === 1) {
      setStep(2);
    }
  };

  const handleDelete = () => {
    // Check current network status (not closure value)
    if (!getNetworkStatus()) {
      RNAlert.alert(t('error'), t('accountDeletionRequiresOnline'));
      return;
    }

    RNAlert.alert(t('accountDeletionTitle'), t('accountDeletionConfirm'), [
      {
        text: t('cancel'),
        style: 'cancel'
      },
      {
        text: t('deleteAccount'),
        style: 'destructive',
        onPress: () => {
          void deleteAccount();
        }
      }
    ]);
  };

  return (
    <ScrollView
      className="mb-safe flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex flex-col gap-4 p-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-foreground">
            {t('accountDeletionTitle')}
          </Text>
          <Button variant="default" size="icon-lg" onPress={goToProjects}>
            <Icon as={HomeIcon} className="text-primary-foreground" />
          </Button>
        </View>

        {!isOnline && (
          <Alert icon={AlertTriangle} variant="destructive">
            <AlertTitle>{t('accountDeletionRequiresOnline')}</AlertTitle>
          </Alert>
        )}

        {step === 1 && (
          <View className="flex flex-col gap-4">
            <View className="flex flex-col gap-2">
              <Text className="text-lg font-semibold text-foreground">
                {t('accountDeletionStep1Title')}
              </Text>
            </View>

            <View className="flex flex-col gap-4 rounded-lg bg-card p-4">
              <Alert icon={InfoIcon}>
                <AlertTitle className="mb-2">
                  {t('accountDeletionWarning')}
                </AlertTitle>
              </Alert>

              <View className="flex flex-col gap-2">
                <Text className="text-base text-foreground">
                  {t('accountDeletionPIIWarning')}
                </Text>
              </View>

              <View className="flex flex-col gap-2">
                <Text className="text-base text-foreground">
                  {t('accountDeletionContributionsInfo')}
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  {t('accountDeletionContributionsAnonymized')}
                </Text>
              </View>

              <View className="flex flex-col gap-2">
                <Pressable
                  onPress={() => {
                    void Linking.openURL(
                      `${process.env.EXPO_PUBLIC_SITE_URL}/terms`
                    );
                  }}
                >
                  <Text className="text-sm text-primary underline">
                    {t('viewTerms')}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View className="flex flex-row gap-2">
              <Button variant="outline" onPress={goBack} className="flex-1">
                <Text>{t('cancel')}</Text>
              </Button>
              <Button
                variant="default"
                onPress={handleContinue}
                className="flex-1"
              >
                <Text>{t('confirm')}</Text>
              </Button>
            </View>
          </View>
        )}

        {step === 2 && (
          <View className="flex flex-col gap-4">
            <View className="flex flex-col gap-2">
              <Text className="text-lg font-semibold text-foreground">
                {t('accountDeletionStep2Title')}
              </Text>
            </View>

            <View className="flex flex-col gap-4 rounded-lg bg-card p-4">
              <Alert icon={AlertTriangle} variant="destructive">
                <AlertTitle className="mb-2">
                  {t('accountDeletionConfirm')}
                </AlertTitle>
              </Alert>

              <View className="flex flex-col gap-2">
                <Text className="text-base text-foreground">
                  {t('accountDeletionWarning')}
                </Text>
              </View>

              <View className="flex flex-col gap-2">
                <Text className="text-base text-foreground">
                  {t('accountDeletionPIIWarning')}
                </Text>
              </View>

              <View className="flex flex-col gap-2">
                <Text className="text-base text-foreground">
                  {t('accountDeletionContributionsInfo')}
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  {t('accountDeletionContributionsAnonymized')}
                </Text>
              </View>
            </View>

            <View className="flex flex-row gap-2">
              <Button
                variant="outline"
                onPress={() => setStep(1)}
                disabled={isPending}
                className="flex-1"
              >
                <Text>{t('cancel')}</Text>
              </Button>
              <Button
                variant="destructive"
                onPress={handleDelete}
                disabled={!isOnline || isPending}
                loading={isPending}
                className="flex-1"
              >
                <Text>{t('deleteAccount')}</Text>
              </Button>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
