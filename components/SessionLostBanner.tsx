import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { AlertTriangle, XIcon } from 'lucide-react-native';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';

export function SessionLostBanner() {
  const { t } = useLocalization();
  const {
    sessionLost,
    sessionLostBannerDismissed,
    dismissSessionLostBanner,
    lostSessionEmail
  } = useAuth();
  const setAuthView = useLocalStore((s) => s.setAuthView);

  if (!sessionLost || sessionLostBannerDismissed) return null;

  return (
    <View className="flex-row items-center justify-between border-b border-border bg-amber-50 px-4 py-3 dark:bg-amber-950">
      <View className="flex-1 flex-row items-center gap-2">
        <Icon as={AlertTriangle} size={20} className="text-amber-600" />
        <View className="flex-1">
          <Text className="text-sm font-medium">
            {t('sessionExpiredSignIn')}
          </Text>
          {lostSessionEmail && (
            <Text className="mt-0.5 text-xs text-muted-foreground">
              {lostSessionEmail}
            </Text>
          )}
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Button size="sm" onPress={() => setAuthView('sign-in')} className="h-8">
          <Text className="text-sm font-medium text-primary-foreground">
            {t('signIn')}
          </Text>
        </Button>
        <TouchableOpacity onPress={dismissSessionLostBanner} className="p-1">
          <Icon as={XIcon} size={20} className="text-muted-foreground" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
