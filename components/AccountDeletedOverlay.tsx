/**
 * Account Deleted Overlay
 *
 * Fullscreen blocking UI shown when user's account has been soft deleted (active = false).
 * Provides option to restore account or logout and return to login/register.
 *
 * Flow:
 * 1. Displayed when profile.active === false in App.tsx
 * 2. Shows message explaining account was deleted
 * 3. Offers restore button (with confirmation) or logout button
 * 4. Blocks all app functionality until restored or logged out
 */

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/database_services/profileService';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, LogOutIcon, RotateCcw } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import RNAlert from '@blazejkustra/react-native-alert';

export function AccountDeletedOverlay() {
  const { t } = useLocalization();
  const { currentUser, signOut } = useAuth();
  const { goToProjects } = useNavigationHelpers();
  const queryClient = useQueryClient();

  const { mutateAsync: restoreAccount, isPending } = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) {
        throw new Error('No user ID found');
      }
      await profileService.restoreAccount(currentUser.id);
    },
    onSuccess: async () => {
      void queryClient.invalidateQueries({
        queryKey: ['profile', currentUser?.id]
      });

      RNAlert.alert(t('success'), t('accountRestoreSuccess'), [
        {
          text: t('ok'),
          isPreferred: true,
          onPress: () => {
            goToProjects();
          }
        }
      ]);
    },
    onError: (error) => {
      console.error('Error restoring account:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      RNAlert.alert(
        t('error'),
        t('accountRestoreError', { error: errorMessage })
      );
    }
  });

  const handleRestore = () => {
    RNAlert.alert(
      t('restoreAccountConfirmTitle'),
      t('restoreAccountConfirmMessage'),
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: t('confirmRestore'),
          onPress: () => {
            void restoreAccount();
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    void signOut();
  };

  return (
    <View
      testID="account-deleted-overlay"
      className="flex-1 items-center justify-center bg-background p-6"
    >
      <View className="w-full max-w-md flex-col gap-6">
        {/* Icon/Warning */}
        <View className="items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
            <Icon as={AlertTriangle} size={40} className="text-destructive" />
          </View>
        </View>

        {/* Title */}
        <View className="flex-col items-center gap-2">
          <Text className="text-center text-2xl font-bold text-foreground">
            {t('accountDeletedTitle')}
          </Text>
        </View>

        {/* Message */}
        <View className="flex-col gap-4">
          <Text className="text-center text-base text-muted-foreground">
            {t('accountDeletedMessage')}
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="flex-col gap-3">
          <Button
            variant="default"
            size="lg"
            onPress={handleRestore}
            disabled={isPending}
            loading={isPending}
            className="w-full"
            testID="account-deleted-restore"
          >
            {!isPending && (
              <Icon
                as={RotateCcw}
                size={20}
                className="mr-2 text-primary-foreground"
              />
            )}
            <Text className="text-lg font-semibold text-primary-foreground">
              {t('restoreAccount')}
            </Text>
          </Button>

          <Button
            variant="outline"
            size="lg"
            onPress={handleLogout}
            disabled={isPending}
            className="w-full"
            testID="account-deleted-logout"
          >
            <Icon as={LogOutIcon} size={20} className="mr-2 text-foreground" />
            <Text className="text-lg font-semibold text-foreground">
              {t('backToLogin')}
            </Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
