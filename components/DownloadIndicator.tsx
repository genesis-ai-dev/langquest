import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { storage } from '@/utils/storage';
import { cn, useThemeColor } from '@/utils/styleUtils';
import { CircleArrowDownIcon, CircleCheckIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, TouchableOpacity } from 'react-native';
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
  // Override default icon color logic
  iconColor?: string;
}

export const DownloadIndicator: React.FC<DownloadIndicatorProps> = ({
  isFlaggedForDownload,
  isLoading,
  onPress,
  size = 20,
  progressPercentage = 0,
  showProgress = false,
  downloadType,
  stats,
  className,
  iconColor
}) => {
  const { isAuthenticated } = useAuth();
  const isConnected = useNetworkStatus();
  const isDisabled = !isConnected && !isFlaggedForDownload;
  const [showWarning, setShowWarning] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const primaryColor = useThemeColor('primary');

  // Hide download indicator for anonymous users (they can't download)
  if (!isAuthenticated) {
    return null;
  }

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
        className: iconColor || 'text-primary'
      };
    }

    if (showProgress && progressPercentage > 0) {
      return {
        Icon: CircleArrowDownIcon,
        className: iconColor || 'text-accent'
      };
    }

    return {
      Icon: CircleArrowDownIcon,
      className: iconColor || (isDisabled ? 'text-muted' : 'text-foreground')
    };
  };

  const { Icon: IconComponent, className: iconClassName } = getIconAndColor();

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        className={cn(isDisabled && 'opacity-50', className)}
        hitSlop={10}
        disabled={isDisabled || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size={size} color={primaryColor} />
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
