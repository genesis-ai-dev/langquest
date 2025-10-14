import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { storage } from '@/utils/storage';
import { cn, useThemeColor } from '@/utils/styleUtils';
import { CircleArrowDownIcon, CircleCheckIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { DownloadConfirmationModal } from './DownloadConfirmationModal';
import { OfflineUndownloadWarning } from './OfflineUndownloadWarning';
import { Icon } from './ui/icon';

interface DownloadIndicatorProps {
  isFlaggedForDownload: boolean;
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
}

export const DownloadIndicator: React.FC<DownloadIndicatorProps> = ({
  isFlaggedForDownload,
  isLoading,
  onPress,
  size = 24,
  progressPercentage = 0,
  showProgress = false,
  downloadType,
  stats,
  className
}) => {
  const isConnected = useNetworkStatus();
  const isDisabled = !isConnected && !isFlaggedForDownload;
  const [showWarning, setShowWarning] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handlePress = async () => {
    if (!isConnected && isFlaggedForDownload) {
      const showWarning = await storage.getOfflineUndownloadWarningEnabled();
      if (showWarning) {
        setShowWarning(true);
        return;
      }
    }

    // Show confirmation modal for project/quest downloads (not already downloaded)
    if (downloadType && stats && !isFlaggedForDownload) {
      setShowConfirmation(true);
      return;
    }

    // Direct download for assets or already downloaded items
    onPress();
  };

  const handleConfirmDownload = () => {
    setShowConfirmation(false);
    onPress();
  };

  const handleCancelDownload = () => {
    setShowConfirmation(false);
  };

  const handleConfirmUndownload = () => {
    setShowWarning(false);
    onPress();
  };

  const handleCancelUndownload = () => {
    setShowWarning(false);
  };

  // Determine icon and color based on state
  const getIconAndColor = () => {
    if (isFlaggedForDownload) {
      return {
        Icon: CircleCheckIcon,
        className: 'text-primary'
      };
    }

    if (showProgress && progressPercentage > 0) {
      return {
        Icon: CircleArrowDownIcon,
        className: 'text-accent'
      };
    }

    return {
      Icon: CircleArrowDownIcon,
      className: isDisabled ? 'text-muted' : 'text-foreground'
    };
  };

  const { Icon: IconComponent, className: iconClassName } = getIconAndColor();

  const primaryColor = useThemeColor('primary');

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        className={cn(isDisabled && 'opacity-50', className)}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        disabled={isDisabled || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size={size} color={primaryColor} />
        ) : showProgress && progressPercentage > 0 && !isFlaggedForDownload ? (
          // Custom progress indicator for quests
          <View
            className="relative items-center justify-center"
            style={{ width: size, height: size }}
          >
            <View
              className="absolute rounded-full bg-muted opacity-30"
              style={{
                width: size,
                height: size
              }}
            />
            <View
              className="absolute left-0 rounded-full bg-accent opacity-60"
              style={{
                width: size * (progressPercentage / 100),
                height: size
              }}
            />
            <IconComponent
              size={size}
              className={cn('absolute', iconClassName)}
            />
          </View>
        ) : (
          <Icon as={IconComponent} size={size} className={iconClassName} />
        )}
      </TouchableOpacity>

      {/* Download confirmation modal */}
      {downloadType && stats && (
        <DownloadConfirmationModal
          visible={showConfirmation}
          onConfirm={handleConfirmDownload}
          onCancel={handleCancelDownload}
          downloadType={downloadType}
          stats={stats}
        />
      )}

      {/* Offline undownload warning */}
      <OfflineUndownloadWarning
        visible={showWarning}
        onConfirm={handleConfirmUndownload}
        onCancel={handleCancelUndownload}
      />
    </>
  );
};
