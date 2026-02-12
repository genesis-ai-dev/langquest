import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import type { DiscoveryState } from '@/hooks/useQuestDownloadDiscovery';
import { cn, useThemeColor } from '@/utils/styleUtils';
import type { LucideIconName } from '@react-native-vector-icons/lucide';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle
} from 'react-native-reanimated';

interface QuestDownloadDiscoveryDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  discoveryState: DiscoveryState;
}

interface CategoryRowProps {
  label: string;
  icon: LucideIconName;
  count: number;
  isLoading: boolean;
  hasError: boolean;
  showCount?: boolean;
}

function CategoryRow({
  label,
  icon,
  count,
  isLoading,
  hasError,
  showCount = true
}: CategoryRowProps) {
  const primaryColor = useThemeColor('primary');
  
  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      opacity: isLoading ? 0.5 : 1
    };
  }, [isLoading]);

  const animatedCountStyle = useAnimatedStyle(() => {
    return {
      opacity: isLoading ? 0.5 : 1
    };
  }, [isLoading]);

  return (
    <View className="flex-row items-center justify-between border-b border-border py-3">
      <View className="flex-row items-center gap-3">
        <Icon name={icon} size={20} className="text-muted-foreground" />
        <Animated.View style={animatedTextStyle}>
          <Text className="text-base">{label}</Text>
        </Animated.View>
      </View>

      <View className="flex-row items-center gap-2">
        {showCount && (
          <Animated.View style={animatedCountStyle}>
            <Text
              className={cn(
                'font-mono text-sm',
                hasError ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {count}
            </Text>
          </Animated.View>
        )}

        {isLoading && (
          <ActivityIndicator size="small" color={primaryColor} />
        )}
        {!isLoading && !hasError && (
          <Icon name="circle-check" size={16} className="text-green-600" />
        )}
        {hasError && (
          <Icon name="circle-alert" size={16} className="text-destructive" />
        )}
      </View>
    </View>
  );
}

export function QuestDownloadDiscoveryDrawer({
  isOpen,
  onOpenChange,
  onContinue,
  discoveryState
}: QuestDownloadDiscoveryDrawerProps) {
  const { t } = useLocalization();
  const { isDiscovering, progressSharedValues, totalRecordsShared, hasError } =
    discoveryState;

  // Use React state for display values
  const [progress, setProgress] = useState({
    quest: { count: 0, isLoading: false, hasError: false },
    project: { count: 0, isLoading: false, hasError: false },
    questAssetLinks: { count: 0, isLoading: false, hasError: false },
    assets: { count: 0, isLoading: false, hasError: false },
    assetContentLinks: { count: 0, isLoading: false, hasError: false },
    votes: { count: 0, isLoading: false, hasError: false },
    questTagLinks: { count: 0, isLoading: false, hasError: false },
    assetTagLinks: { count: 0, isLoading: false, hasError: false },
    tags: { count: 0, isLoading: false, hasError: false },
    languages: { count: 0, isLoading: false, hasError: false }
  });
  const [totalRecords, setTotalRecords] = useState(0);

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
      total: totalRecordsShared.value
    }),
    (result, prev) => {
      // Only update if values actually changed to prevent render loops
      if (!prev || JSON.stringify(result) !== JSON.stringify(prev)) {
        runOnJS(setProgress)({
          quest: result.quest,
          project: result.project,
          questAssetLinks: result.questAssetLinks,
          assets: result.assets,
          assetContentLinks: result.assetContentLinks,
          votes: result.votes,
          questTagLinks: result.questTagLinks,
          assetTagLinks: result.assetTagLinks,
          tags: result.tags,
          languages: result.languages
        });
        runOnJS(setTotalRecords)(result.total);
      }
    }
  );

  return (
    <Drawer
      open={isOpen}
      onOpenChange={onOpenChange}
      dismissible={!isDiscovering}
    >
      <DrawerContent className="pb-safe">
        <DrawerHeader>
          <DrawerTitle>
            {t('discoveringQuestData') || 'Discovering Quest Data'}
          </DrawerTitle>
          <Text className="text-sm text-muted-foreground">
            {isDiscovering
              ? t('analyzingRelatedRecords') || 'Analyzing related records...'
              : t('discoveryComplete') || 'Discovery complete'}
          </Text>
        </DrawerHeader>

        <View className="flex flex-col gap-2 px-4">
          <View className="flex-col gap-0">
            <CategoryRow label="Quest" icon="folder" {...progress.quest} />
            <CategoryRow
              label="Project"
              icon="database"
              {...progress.project}
            />
            <CategoryRow
              label="Quest-Asset Links"
              icon="link"
              {...progress.questAssetLinks}
            />
            <CategoryRow
              label="Assets"
              icon="file-text"
              {...progress.assets}
            />
            <CategoryRow
              label="Asset Content Links"
              icon="link"
              {...progress.assetContentLinks}
            />
            <CategoryRow
              label="Votes"
              icon="thumbs-up"
              {...progress.votes}
            />
            <CategoryRow
              label="Quest Tags"
              icon="link"
              {...progress.questTagLinks}
            />
            <CategoryRow
              label="Asset Tags"
              icon="link"
              {...progress.assetTagLinks}
            />
            <CategoryRow label="Tags" icon="tag" {...progress.tags} />
            <CategoryRow
              label="Languages"
              icon="database"
              {...progress.languages}
            />
          </View>
        </View>

        <DrawerFooter>
          <View className="flex-row items-center justify-between rounded-lg bg-muted p-3">
            <Text className="text-sm font-semibold">
              {t('totalRecords') || 'Total Records'}:
            </Text>
            <Text className="text-lg font-bold text-primary">
              {totalRecords}
            </Text>
          </View>

          {hasError && !isDiscovering && (
            <View className="rounded-lg bg-destructive/10 p-3">
              <Text className="text-sm text-destructive">
                {totalRecords === 0
                  ? t('questNotFoundInCloud') ||
                    'Quest not found in cloud database. It may only exist locally or you may not have permission to access it. Try refreshing the page or contact support if this persists.'
                  : t('discoveryErrorsOccurred') ||
                    'Some errors occurred during discovery. You can still download the discovered records.'}
              </Text>
            </View>
          )}

          <Button
            onPress={onContinue}
            disabled={isDiscovering || totalRecords === 0}
          >
            <Text className="font-bold">
              {isDiscovering
                ? t('discovering') || 'Discovering...'
                : t('continueToDownload') || 'Continue to Download'}
            </Text>
          </Button>

          <DrawerClose variant="outline" disabled={isDiscovering}>
            <Text>{t('cancel')}</Text>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
