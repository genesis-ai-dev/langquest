/**
 * Account Deletion View
 *
 * Multi-step account deletion flow that sets profile.active = false (soft delete).
 * Users can restore their account later from the AccountDeletedOverlay.
 */

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Link } from '@/components/ui/link';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/database_services/profileService';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { getNetworkStatus, useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useLocalStore } from '@/store/localStore';
import { resetDatabase } from '@/utils/dbUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  HomeIcon,
  InfoIcon,
  Trash2
} from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

export default function AccountDeletionView() {
  const { t } = useLocalization();
  const { currentUser, signOut } = useAuth();
  const { goToProjects, goBack } = useAppNavigation();
  const isOnline = useNetworkStatus();
  const [step, setStep] = useState<1 | 2>(1);
  const setSystemReady = useLocalStore((state) => state.setSystemReady);

  const { mutateAsync: deleteAccount, isPending } = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) {
        throw new Error('No user ID found');
      }

      // Check network status inside mutation (not closure value)
      if (!getNetworkStatus()) {
        throw new Error(t('accountDeletionRequiresOnline'));
      }

      // 1. Soft delete profile (set active = false)
      await profileService.deleteAccount(currentUser.id);

      // 2. Wait for PowerSync to sync the profile.active change
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 3. Cleanup and reinitialize system before signing out
      console.log(
        '[AccountDeletionView] Cleaning up system before sign out...'
      );
      setSystemReady(false);
      try {
        await system.cleanup();
        await resetDatabase();
        console.log(
          '[AccountDeletionView] System cleanup and database reset complete'
        );
      } catch (error) {
        console.error('[AccountDeletionView] Error during cleanup:', error);
      }

      // 4. Sign out user (this will trigger final cleanup via AuthContext)
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

    RNAlert.alert(
      t('accountDeletionConfirm'),
      t('accountDeletionConfirmMessage'),
      [
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
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="flex flex-col gap-6 p-6">
        {/* Header */}
        <View className="flex flex-row items-center justify-between">
          <View className="flex flex-row items-center gap-3">
            <Button variant="ghost" size="icon" onPress={goBack}>
              <Icon as={ChevronLeft} size={24} className="text-foreground" />
            </Button>
            <Text className="text-2xl font-bold text-foreground">
              {step === 1
                ? t('accountDeletionStep1Title')
                : t('accountDeletionStep2Title')}
            </Text>
          </View>
          <Button variant="ghost" size="icon" onPress={goToProjects}>
            <Icon as={HomeIcon} size={24} className="text-foreground" />
          </Button>
        </View>

        {/* Offline Warning */}
        {!isOnline && (
          <Alert icon={InfoIcon} variant="destructive">
            <AlertTitle>{t('accountDeletionRequiresOnline')}</AlertTitle>
          </Alert>
        )}

        {/* Step 1: Warning and Information */}
        {step === 1 && (
          <View className="flex flex-col gap-6">
            <Alert icon={AlertTriangle} variant="destructive">
              <AlertTitle>{t('accountDeletionWarning')}</AlertTitle>
            </Alert>

            <View className="flex flex-col gap-4">
              <Text className="text-base text-foreground">
                {t('accountDeletionPIIWarning')}
              </Text>

              <Text className="text-base text-foreground">
                {t('accountDeletionContributionsInfo')}
              </Text>
            </View>

            <View className="flex flex-col gap-2">
              <Link href="/terms" push>
                {t('viewTerms')}
              </Link>
            </View>
          </View>
        )}

        {/* Step 2: Final Confirmation */}
        {step === 2 && (
          <View className="flex flex-col gap-6">
            <Alert icon={AlertTriangle} variant="destructive">
              <AlertTitle>{t('accountDeletionConfirm')}</AlertTitle>
            </Alert>

            <View className="flex flex-col gap-4">
              <Text className="text-base text-foreground">
                {t('accountDeletionWarning')}
              </Text>

              <Text className="text-base text-foreground">
                {t('accountDeletionPIIWarning')}
              </Text>

              <Text className="text-base text-foreground">
                {t('accountDeletionContributionsInfo')}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View className="flex flex-row gap-2">
          {step === 1 ? (
            <>
              <Button variant="outline" onPress={goBack} className="flex-1">
                <Text>{t('cancel')}</Text>
              </Button>
              <Button
                variant="default"
                onPress={handleContinue}
                disabled={!isOnline}
                className="flex-1"
              >
                <Text>{t('continue')}</Text>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onPress={() => setStep(1)}
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
                {!isPending && (
                  <Icon
                    as={Trash2}
                    size={20}
                    className="mr-2 text-destructive-foreground"
                  />
                )}
                <Text className="text-destructive-foreground">
                  {t('deleteAccount')}
                </Text>
              </Button>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
