import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { cn, useThemeColor } from '@/utils/styleUtils';
import { CircleArrowDownIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { resolveDownloadPressAction } from './downloadPressAction';
import { DownloadConfirmationModal } from './DownloadConfirmationModal';
import { Icon } from './ui/icon';

interface DownloadIndicatorProps {
  isLoading: boolean;
  onPress: () => void;
  size?: number;
  // Enhanced props for quest download progress
  progressPercentage?: number;
  showProgress?: boolean;
  // New props for download confirmation
  downloadType?: 'project' | 'quest';
  stats?: {
    totalAssets: number;
    totalTranslations?: number;
    totalQuests?: number;
  };
  className?: string;
  // Override default icon color logic
  iconColor?: string;
  testID?: string;
}

export const DownloadIndicator: React.FC<DownloadIndicatorProps> = ({
  isLoading,
  onPress,
  size = 20,
  progressPercentage = 0,
  showProgress = false,
  downloadType,
  stats,
  className,
  iconColor,
  testID
}) => {
  const { isAuthenticated } = useAuth();
  const isConnected = useNetworkStatus();
  const isDisabled = !isConnected;
  const [showConfirmation, setShowConfirmation] = useState(false);
  const primaryColor = useThemeColor('primary');

  // Hide download indicator for anonymous users (they can't download)
  if (!isAuthenticated) {
    return null;
  }

  const handlePress = () => {
    const action = resolveDownloadPressAction({
      hasDownloadConfirmation: Boolean(downloadType && stats)
    });

    if (action === 'download-confirm') {
      setShowConfirmation(true);
      return;
    }

    onPress();
  };

  const handleConfirmDownload = () => {
    setShowConfirmation(false);
    onPress();
  };

  const handleCancelDownload = () => {
    setShowConfirmation(false);
  };

  const iconClassName =
    iconColor ||
    (showProgress && progressPercentage > 0
      ? 'text-accent'
      : isDisabled
        ? 'text-muted'
        : 'text-foreground');

  return (
    <>
      <Button
        variant="plain"
        size="auto"
        onPress={handlePress}
        className={cn(isDisabled && 'opacity-50', className)}
        hitSlop={10}
        disabled={isDisabled || isLoading}
        testID={testID}
        accessibilityLabel={testID}
      >
        {isLoading ? (
          <ActivityIndicator size={size} color={primaryColor} />
        ) : (
          <Icon
            as={CircleArrowDownIcon}
            size={size}
            className={iconClassName}
          />
        )}
      </Button>

      {downloadType && stats && (
        <DownloadConfirmationModal
          visible={showConfirmation}
          onConfirm={handleConfirmDownload}
          onCancel={handleCancelDownload}
          downloadType={downloadType}
          stats={stats}
        />
      )}
    </>
  );
};
