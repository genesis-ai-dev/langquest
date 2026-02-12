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
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import RNAlert from '@blazejkustra/react-native-alert';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { View } from 'react-native';

export function AccountDeletedOverlay() {
  const { t } = useLocalization();
  const { currentUser, signOut } = useAuth();
  const { goToProjects } = useAppNavigation();
  const queryClient = useQueryClient();
  const setSystemReady = useLocalStore((state) => state.setSystemReady);

  const { mutateAsync: restoreAccount, isPending } = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) {
        throw new Error('No user ID found');
      }
      await profileService.restoreAccount(currentUser.id);
    },
    onSuccess: async () => {
      // Wait for PowerSync to sync the profile.active change
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Reinitialize system to recreate views etc.
      console.log(
        '[AccountDeletedOverlay] Reinitializing system after account restore...'
      );
      setSystemReady(false);
      try {
        await system.cleanup();
        await system.init();
        setSystemReady(true);
        console.log(
          '[AccountDeletedOverlay] System reinitialized successfully'
        );
      } catch (error) {
        console.error(
          '[AccountDeletedOverlay] Failed to reinitialize system:',
          error
        );
        setSystemReady(true); // Set to true anyway so user isn't stuck
      }

      // Invalidate profile query to refresh
      void queryClient.invalidateQueries({
        queryKey: ['profile', currentUser?.id]
      });

      RNAlert.alert(t('success'), t('accountRestoreSuccess'), [
        {
          text: t('ok'),
          onPress: () => {
            // Navigate to projects page after restore
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
          text: t('restoreAccount'),
          onPress: () => {
            void restoreAccount().then(() => {
              goToProjects();
            });
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    void signOut();
  };

  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <View className="w-full max-w-md flex-col gap-6">
        {/* Icon/Warning */}
        <View className="items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
            <Icon
              name="triangle-alert"
              size={40}
              className="text-destructive"
            />
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
          >
            {!isPending && (
              <Icon
                name="rotate-ccw"
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
          >
            <Icon name="log-out" size={20} className="mr-2 text-foreground" />
            <Text className="text-lg font-semibold text-foreground">
              {t('backToLogin')}
            </Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
