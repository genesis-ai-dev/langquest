/**
 * Scheduled Deletion Overlay
 *
 * Shown when the user has requested permanent account erasure and is in the
 * 30-day grace period (deletion_requested_at set). Offers cancel or sign out.
 */

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/database_services/profileService';
import { system } from '@/db/powersync/system';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, LogOutIcon, XCircle } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import RNAlert from '@blazejkustra/react-native-alert';

interface ScheduledDeletionOverlayProps {
  purgeDate: string;
}

function formatPurgeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

export function ScheduledDeletionOverlay({
  purgeDate
}: ScheduledDeletionOverlayProps) {
  const { t } = useLocalization();
  const { currentUser, signOut } = useAuth();
  const { goToProjects } = useNavigationHelpers();
  const queryClient = useQueryClient();
  const setSystemReady = useLocalStore((state) => state.setSystemReady);
  const formattedPurgeDate = formatPurgeDate(purgeDate);

  const { mutateAsync: cancelDeletion, isPending } = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) {
        throw new Error('No user ID found');
      }
      await profileService.cancelScheduledDeletion(currentUser.id);
    },
    onSuccess: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));

      setSystemReady(false);
      try {
        await system.cleanup();
        await system.init();
        setSystemReady(true);
      } catch (error) {
        console.error(
          '[ScheduledDeletionOverlay] Failed to reinitialize system:',
          error
        );
        setSystemReady(true);
      }

      void queryClient.invalidateQueries({
        queryKey: ['profile', currentUser?.id]
      });

      RNAlert.alert(t('success'), t('cancelDeletionSuccess'), [
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
      console.error('Error canceling scheduled deletion:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      RNAlert.alert(
        t('error'),
        t('cancelDeletionError', { error: errorMessage })
      );
    }
  });

  const handleCancelDeletion = () => {
    RNAlert.alert(
      t('cancelDeletionConfirmTitle'),
      t('cancelDeletionConfirmMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('cancelDeletion'),
          onPress: () => {
            void cancelDeletion();
          }
        }
      ]
    );
  };

  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <View className="w-full max-w-md flex-col gap-6">
        <View className="items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
            <Icon as={AlertTriangle} size={40} className="text-destructive" />
          </View>
        </View>

        <View className="flex-col items-center gap-2">
          <Text className="text-center text-2xl font-bold text-foreground">
            {t('scheduledDeletionTitle')}
          </Text>
        </View>

        <View className="flex-col gap-4">
          <Text className="text-center text-base text-muted-foreground">
            {t('scheduledDeletionMessage', { purgeDate: formattedPurgeDate })}
          </Text>
        </View>

        <View className="flex-col gap-3">
          <Button
            variant="default"
            size="lg"
            onPress={handleCancelDeletion}
            disabled={isPending}
            loading={isPending}
            className="w-full"
          >
            {!isPending && (
              <Icon
                as={XCircle}
                size={20}
                className="mr-2 text-primary-foreground"
              />
            )}
            <Text className="text-lg font-semibold text-primary-foreground">
              {t('cancelDeletion')}
            </Text>
          </Button>

          <Button
            variant="outline"
            size="lg"
            onPress={() => {
              void signOut();
            }}
            disabled={isPending}
            className="w-full"
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
