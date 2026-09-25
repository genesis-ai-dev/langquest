import { DownloadStatusBadge } from '@/components/DownloadStatusBadge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/hooks/useLocalization';
import { formatRelativeDate } from '@/utils/dateUtils';
import { cn } from '@/utils/styleUtils';
import { HardDriveIcon, PlusCircleIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

export interface QuestVersionPickerCardProps {
  versionLabel?: string | null;
  creatorName?: string | null;
  isCurrentUser: boolean;
  createdAt: string;
  isLocal: boolean;
  isCloud: boolean;
  isDownloaded: boolean;
  isDownloading: boolean;
  visible?: boolean;
  onPress: () => void;
}

function buildPrimaryLabel(
  creatorName: string,
  isCurrentUser: boolean,
  versionLabel: string | null | undefined
): string {
  const creatorLine = `${creatorName}${isCurrentUser ? ' (you)' : ''}`;
  const trimmedLabel = versionLabel?.trim();
  return trimmedLabel ? `${creatorLine} · ${trimmedLabel}` : creatorLine;
}

function buildSecondaryLabel(
  isCurrentUser: boolean,
  isLocal: boolean,
  createdAt: string
): string {
  const parts: string[] = [];
  if (isCurrentUser && isLocal) {
    parts.push('Draft');
  }
  parts.push(formatRelativeDate(createdAt));
  return parts.join(' · ');
}

/**
 * Card for picking among multiple quest versions (Bible chapter / FIA pericope).
 */
export function QuestVersionPickerCard({
  versionLabel,
  creatorName,
  isCurrentUser,
  createdAt,
  isLocal,
  isCloud,
  isDownloaded,
  isDownloading,
  visible = true,
  onPress
}: QuestVersionPickerCardProps) {
  const { currentUser } = useAuth();
  const isSignedIn = Boolean(currentUser);
  const displayCreator = creatorName?.trim() || 'Unknown';
  const needsDownload = isSignedIn && isCloud && !isDownloaded;
  const avatarInitial = displayCreator.charAt(0).toUpperCase();
  const primaryLabel = buildPrimaryLabel(
    displayCreator,
    isCurrentUser,
    versionLabel
  );
  const secondaryLabel = buildSecondaryLabel(isCurrentUser, isLocal, createdAt);

  return (
    <Pressable
      onPress={onPress}
      testID="bible-chapter-version"
      accessibilityLabel="bible-chapter-version"
      className={cn(
        'flex-row items-center gap-3 rounded-lg border border-border bg-card p-4 active:opacity-70',
        needsDownload && 'opacity-60',
        !visible && 'opacity-50'
      )}
    >
      <View
        className={cn(
          'h-10 w-10 items-center justify-center rounded-full',
          isLocal ? 'bg-chart-2' : needsDownload ? 'bg-muted' : 'bg-primary'
        )}
      >
        <Text
          className={cn(
            'font-semibold',
            isLocal || needsDownload
              ? 'text-secondary-foreground'
              : 'text-primary-foreground'
          )}
        >
          {avatarInitial}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="font-semibold">{primaryLabel}</Text>
        <Text className="text-sm text-muted-foreground">{secondaryLabel}</Text>
      </View>
      {isSignedIn ? (
        <View className="items-center justify-center">
          {isLocal && (
            <Icon as={HardDriveIcon} size={18} className="text-chart-2" />
          )}
          {!isLocal && (
            <DownloadStatusBadge
              status={
                isDownloaded
                  ? 'downloaded'
                  : isDownloading
                    ? 'downloading'
                    : 'cloud'
              }
              size={18}
            />
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

export function QuestCreateNewVersionRow({ onPress }: { onPress: () => void }) {
  const { t } = useLocalization();

  return (
    <Pressable
      onPress={onPress}
      testID="quest-create-new-version"
      accessibilityLabel="quest-create-new-version"
      className="flex-row items-center gap-3 rounded-lg border border-dashed border-border p-4 active:opacity-70"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icon as={PlusCircleIcon} size={20} className="text-primary" />
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-primary">
          {t('createNewVersion')}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {t('startNewRecording')}
        </Text>
      </View>
    </Pressable>
  );
}
