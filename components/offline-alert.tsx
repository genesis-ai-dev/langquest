import { Alert, AlertTitle } from '@/components/ui/alert';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { WifiOffIcon } from 'lucide-react-native';
import React from 'react';

/**
 * OfflineAlert component that displays an alert when the device is offline.
 * Only renders when the network status is offline.
 */
export function OfflineAlert() {
  const { t } = useLocalization();
  const isOnline = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <Alert icon={WifiOffIcon} variant="destructive">
      <AlertTitle>{t('internetConnectionRequired')}</AlertTitle>
    </Alert>
  );
}
