import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerScrollView,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import type { VerificationState } from '@/hooks/useQuestOffloadVerification';
import { cn } from '@/utils/styleUtils';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CloudIcon,
  DatabaseIcon,
  FileTextIcon,
  FolderIcon,
  LanguagesIcon,
  LinkIcon,
  TagIcon,
  ThumbsUpIcon,
  UploadCloudIcon,
  XIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Spinner } from './ui/spinner';

interface QuestOffloadVerificationDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  verificationState: VerificationState;
  isOffloading: boolean;
}

interface CategoryRowProps {
  label: string;
  icon: typeof FolderIcon;
  count: number;
  verified: number;
  isVerifying: boolean;
  hasError: boolean;
  showCount?: boolean;
}

function CategoryRow({
  label,
  icon,
  count,
  verified,
  isVerifying,
  hasError,
  showCount = true
}: CategoryRowProps) {
  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      opacity: isVerifying ? 0.5 : 1
    };
  }, [isVerifying]);

  const animatedCountStyle = useAnimatedStyle(() => {
    return {
      opacity: isVerifying ? 0.5 : 1
    };
  }, [isVerifying]);

  const isFullyVerified =
    !isVerifying && !hasError && count > 0 && verified === count;
  const isPartiallyVerified =
    !isVerifying && !hasError && verified > 0 && verified < count;

  return (
    <View className="flex-row items-center justify-between border-b border-border py-1.5">
      <View className="flex-row items-center gap-2">
        <Icon as={icon} size={16} className="text-muted-foreground" />
        <Animated.View style={animatedTextStyle}>
          <Text className="text-sm">{label}</Text>
        </Animated.View>
      </View>

      <View className="flex-row items-center gap-1.5">
        {showCount && (
          <Animated.View style={animatedCountStyle}>
            <Text
              className={cn(
                'font-mono text-xs',
                hasError ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {verified}/{count}
            </Text>
          </Animated.View>
        )}

        {isVerifying && <Spinner size="small" />}
        {isFullyVerified && (
          <Icon as={CloudIcon} size={14} className="text-green-600" />
        )}
        {isPartiallyVerified && (
          <Icon as={UploadCloudIcon} size={14} className="text-yellow-600" />
        )}
        {hasError && (
          <Icon as={AlertCircleIcon} size={14} className="text-destructive" />
        )}
        {!isVerifying && !hasError && count === 0 && (
          <Icon
            as={CheckCircleIcon}
            size={14}
            className="text-muted-foreground"
          />
        )}
      </View>
    </View>
  );
}

export function QuestOffloadVerificationDrawer({
  isOpen,
  onOpenChange,
  onContinue,
  verificationState,
  isOffloading
}: QuestOffloadVerificationDrawerProps) {
  const { t } = useLocalization();
  const {
    isVerifying,
    hasPendingUploads,
    pendingUploadCount,
    progressSharedValues,
    totalRecordsShared,
    hasError,
    estimatedStorageBytes
  } = verificationState;

  // Use React state for display values
  const [progress, setProgress] = useState({
    quest: { count: 0, verified: 0, isVerifying: false, hasError: false },
    project: { count: 0, verified: 0, isVerifying: false, hasError: false },
    questAssetLinks: {
      count: 0,
      verified: 0,
      isVerifying: false,
      hasError: false
    },
    assets: { count: 0, verified: 0, isVerifying: false, hasError: false },
    assetContentLinks: {
      count: 0,
      verified: 0,
      isVerifying: false,
      hasError: false
    },
    votes: { count: 0, verified: 0, isVerifying: false, hasError: false },
    questTagLinks: {
      count: 0,
      verified: 0,
      isVerifying: false,
      hasError: false
    },
    assetTagLinks: {
      count: 0,
      verified: 0,
      isVerifying: false,
      hasError: false
    },
    tags: { count: 0, verified: 0, isVerifying: false, hasError: false },
    languages: { count: 0, verified: 0, isVerifying: false, hasError: false },
    attachments: { count: 0, verified: 0, isVerifying: false, hasError: false }
  });
  const [totalRecords, setTotalRecords] = useState(0);

  // Wrapper functions for scheduleOnRN (must be function references, not anonymous functions)
  const updateProgress = (progressData: typeof progress) => {
    setProgress(progressData);
  };

  const updateTotalRecords = (total: number) => {
    setTotalRecords(total);
  };

  // Sync shared values to React state using useAnimatedReaction
  useAnimatedReaction(
    () => ({
      quest: progressSharedValues.quest.value,
      project: progressSharedValues.project.value,
      questAssetLinks: progressSharedValues.questAssetLinks.value,
      assets: progressSharedValues.assets.value,
      assetContentLinks: progressSharedValues.assetContentLinks.value,
      votes: progressSharedValues.votes.value,
      questTagLinks: progressSharedValues.questTagLinks.value,
      assetTagLinks: progressSharedValues.assetTagLinks.value,
      tags: progressSharedValues.tags.value,
      languages: progressSharedValues.languages.value,
      attachments: progressSharedValues.attachments.value,
      total: totalRecordsShared.value
    }),
    (result, prev) => {
      // Only update if values actually changed to prevent render loops
      if (!prev || JSON.stringify(result) !== JSON.stringify(prev)) {
        scheduleOnRN(updateProgress, {
          quest: result.quest,
          project: result.project,
          questAssetLinks: result.questAssetLinks,
          assets: result.assets,
          assetContentLinks: result.assetContentLinks,
          votes: result.votes,
          questTagLinks: result.questTagLinks,
          assetTagLinks: result.assetTagLinks,
          tags: result.tags,
          languages: result.languages,
          attachments: result.attachments
        });
        scheduleOnRN(updateTotalRecords, result.total);
      }
    }
  );

  // Calculate if ready to offload (all records verified, no errors, no pending uploads)
  const isReadyToOffload =
    !isVerifying &&
    !hasPendingUploads &&
    !hasError &&
    totalRecords > 0 &&
    Object.values(progress).every(
      (p) => p.count === 0 || p.verified === p.count
    );

  // Format storage size
  const formatStorageSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <Drawer
      open={isOpen}
      onOpenChange={onOpenChange}
      dismissible={!isOffloading}
      enableDynamicSizing={false}
    >
      <DrawerContent className="pb-safe">
        <DrawerHeader>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <DrawerTitle>{t('offloadQuest') || 'Offload Quest'}</DrawerTitle>
              <Text className="text-sm text-muted-foreground">
                {hasPendingUploads
                  ? t('pendingUploadsDetected') || 'Pending uploads detected'
                  : isVerifying
                    ? t('verifyingCloudData') || 'Verifying data in cloud...'
                    : isReadyToOffload
                      ? t('readyToOffload') || 'Ready to offload'
                      : hasError
                        ? t('cannotOffloadErrors') ||
                          'Cannot offload - errors detected'
                        : t('checkingPendingChanges') ||
                          'Checking for pending changes...'}
              </Text>
            </View>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" disabled={isOffloading}>
                <Icon as={XIcon} size={24} />
              </Button>
            </DrawerClose>
          </View>
        </DrawerHeader>

        {/* Scrollable Content */}
        <DrawerScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          style={{ flexGrow: 1 }}
        >
          {hasPendingUploads ? (
            <View className="flex flex-col gap-4 py-6">
              <View className="rounded-lg bg-yellow-500/10 p-4">
                <View className="mb-2 flex-row items-center gap-2">
                  <Icon
                    as={UploadCloudIcon}
                    size={20}
                    className="text-yellow-600"
                  />
                  <Text className="font-semibold text-yellow-600">
                    {t('pendingUploadsDetected') || 'Pending Uploads Detected'}
                  </Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  {t('pendingUploadsMessage') ||
                    `You have ${pendingUploadCount} pending upload(s). Please wait for all changes to upload to the cloud before offloading. Connect to the internet and wait for sync to complete.`}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View className="flex-col gap-0">
                <CategoryRow
                  label="Quest"
                  icon={FolderIcon}
                  {...progress.quest}
                />
                <CategoryRow
                  label="Project"
                  icon={DatabaseIcon}
                  {...progress.project}
                />
                <CategoryRow
                  label="Quest-Asset Links"
                  icon={LinkIcon}
                  {...progress.questAssetLinks}
                />
                <CategoryRow
                  label="Assets"
                  icon={FileTextIcon}
                  {...progress.assets}
                />
                <CategoryRow
                  label="Asset Content Links"
                  icon={LinkIcon}
                  {...progress.assetContentLinks}
                />
                <CategoryRow
                  label="Votes"
                  icon={ThumbsUpIcon}
                  {...progress.votes}
                />
                <CategoryRow
                  label="Quest Tags"
                  icon={LinkIcon}
                  {...progress.questTagLinks}
                />
                <CategoryRow
                  label="Asset Tags"
                  icon={LinkIcon}
                  {...progress.assetTagLinks}
                />
                <CategoryRow label="Tags" icon={TagIcon} {...progress.tags} />
                <CategoryRow
                  label="Languages"
                  icon={LanguagesIcon}
                  {...progress.languages}
                />
                <CategoryRow
                  label="Attachments"
                  icon={FileTextIcon}
                  {...progress.attachments}
                />
              </View>

              {/* Summary info */}
              <View className="mb-2 mt-4 flex-row items-center justify-between rounded-lg bg-muted p-3">
                <Text className="text-sm font-semibold">
                  {t('totalRecords') || 'Total Records'}:
                </Text>
                <Text className="text-lg font-bold text-primary">
                  {totalRecords}
                </Text>
              </View>

              {estimatedStorageBytes > 0 && (
                <View className="mb-2 flex-row items-center justify-between rounded-lg bg-muted p-3">
                  <Text className="text-sm font-semibold">
                    {t('storageToFree') || 'Storage to Free'}:
                  </Text>
                  <Text className="text-lg font-bold text-primary">
                    {formatStorageSize(estimatedStorageBytes)}
                  </Text>
                </View>
              )}

              {/* Warnings and errors in scrollable area */}
              {isReadyToOffload && (
                <View className="mb-2 rounded-lg bg-yellow-500/10 p-3">
                  <Text className="text-sm text-yellow-600">
                    {t('offloadWarning') ||
                      'This will delete local copies. Data will remain safely in the cloud and can be re-downloaded later.'}
                  </Text>
                </View>
              )}

              {hasError && !isVerifying && (
                <View className="mb-2 min-h-10 rounded-lg bg-destructive/10 p-3">
                  <View className="mb-2 flex-row items-center gap-2">
                    <Icon
                      as={AlertCircleIcon}
                      size={20}
                      className="text-destructive"
                    />
                    <Text className="font-semibold text-destructive">
                      {t('missingCloudData') || 'Missing Cloud Data'}
                    </Text>
                  </View>
                  <Text className="text-sm text-destructive">
                    {t('cannotOffloadErrors') ||
                      'Some data has not been uploaded to the cloud yet. Check the list above for items marked in red - these need to sync before you can safely offload.'}
                  </Text>
                  {progress.attachments.count >
                    progress.attachments.verified && (
                    <Text className="mt-2 text-sm font-semibold text-destructive">
                      ⚠️{' '}
                      {progress.attachments.count -
                        progress.attachments.verified}{' '}
                      audio file(s) not uploaded to cloud storage
                    </Text>
                  )}

                  {/* Dev-only force offload */}
                  {__DEV__ && (
                    <View className="mt-3 rounded border border-yellow-600 bg-yellow-500/20 p-2">
                      <Text className="mb-2 text-xs font-bold text-yellow-600">
                        ⚠️ DEV MODE ONLY
                      </Text>
                      <Text className="mb-2 text-xs text-yellow-600">
                        Force offload will delete local data even if not fully
                        backed up. Use only for testing!
                      </Text>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-yellow-600"
                        onPress={onContinue}
                        disabled={hasPendingUploads || isOffloading}
                      >
                        <Text className="text-xs font-bold text-yellow-600">
                          Force Offload (Dev Only)
                        </Text>
                      </Button>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </DrawerScrollView>

        <DrawerFooter>
          <Button
            onPress={onContinue}
            disabled={!isReadyToOffload || hasPendingUploads}
            loading={isOffloading}
            variant={isReadyToOffload ? 'destructive' : 'default'}
          >
            <Text className="font-bold">
              {isVerifying
                ? t('verifyingCloudData') || 'Verifying...'
                : hasPendingUploads
                  ? t('waitingForUploads') || 'Waiting for Uploads'
                  : isReadyToOffload
                    ? t('continueToOffload') || 'Offload from Device'
                    : t('cannotOffload') || 'Cannot Offload'}
            </Text>
          </Button>

          <DrawerClose asChild>
            <Button variant="outline" disabled={isOffloading}>
              <Text>{t('cancel')}</Text>
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
