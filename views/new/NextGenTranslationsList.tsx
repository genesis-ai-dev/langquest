import { TranslationCard } from '@/components/TranslationCard';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useStatusContext } from '@/contexts/StatusContext';
import type { AssetWithVoteCount } from '@/hooks/db/useTranslations';
import { useTargetAssetsWithVoteCountByAssetId } from '@/hooks/db/useTranslations';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useBlockedTranslationsCount } from '@/hooks/useBlockedCount';
import { useLocalization } from '@/hooks/useLocalization';
import type { MembershipRole } from '@/hooks/useUserPermissions';
import type { SortOrder, WithSource } from '@/utils/dbUtils';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { getLocalUri } from '@/utils/fileUtils';
import { getThemeColor } from '@/utils/styleUtils';
import { LegendList } from '@legendapp/list';
import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  CalendarIcon,
  LockIcon,
  ShieldOffIcon,
  ThumbsUpIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import NextGenTranslationModal from './NextGenTranslationModalAlt';

interface NextGenTranslationsListProps {
  assetId: string;
  assetName?: string | null;
  refreshKey?: number;
  // Props passed from parent to avoid re-querying
  projectData?: {
    private: boolean;
    name?: string;
    id?: string;
  } | null;
  canVote?: boolean;
  membership?: MembershipRole;
}

type SortOption = 'voteCount' | 'dateSubmitted';

export default function NextGenTranslationsList({
  assetId,
  refreshKey,
  projectData,
  canVote: canVoteProp,
  membership: _membershipProp
}: NextGenTranslationsListProps) {
  const { t } = useLocalization();
  const [useOfflineData, setUseOfflineData] = useState(false);
  const [open, setOpen] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('voteCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedTranslationId, setSelectedTranslationId] = useState<
    string | null
  >(null);
  const [voteRefreshKey, setVoteRefreshKey] = useState(0);

  const _currentLayer = useStatusContext();

  const {
    data: assets,
    isLoading,
    hasError: _hasError
  } = useTargetAssetsWithVoteCountByAssetId(
    assetId,
    false, // showInvisibleContent - using false as default since property doesn't exist
    String(refreshKey),
    String(voteRefreshKey),
    useOfflineData,
    sortOption,
    sortOrder
  );

  // Count blocked translations
  const blockedCount = useBlockedTranslationsCount(assetId);

  // Use props from parent if available, otherwise default behavior
  const isPrivateProject = projectData?.private || false;
  const canVote = canVoteProp !== undefined ? canVoteProp : !isPrivateProject;

  // Collect audio IDs for attachment states
  const audioIds = React.useMemo(() => {
    return assets.flatMap((trans) => trans.audio).filter(Boolean);
  }, [assets]);

  const { attachmentStates, isLoading: _isLoadingAttachments } =
    useAttachmentStates(audioIds);

  const getPreviewText = (fullText: string, maxLength = 50) => {
    if (!fullText) return '(Empty translation)';
    if (fullText.length <= maxLength) return fullText;
    return fullText.substring(0, maxLength).trim() + '...';
  };

  const getAudioSegments = (asset: WithSource<AssetWithVoteCount>) => {
    if (!asset.audio) return undefined;
    const localUris = asset.audio.map((c) =>
      getLocalUri(attachmentStates.get(c)?.local_uri ?? '')
    );
    return localUris;
  };

  const handleTranslationPress = (translationId: string) => {
    // Always allow opening modal - voting restrictions are handled inside the modal
    setSelectedTranslationId(translationId);
    setOpen(true);
  };

  const handleVoteSuccess = () => {
    // Increment vote refresh key to trigger re-queries
    setVoteRefreshKey((prev) => prev + 1);
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  return (
    <View className="flex-1">
      <View className="h-px bg-border" />

      {/* Header with toggle and sort options */}
      <View className="flex-col gap-3 py-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Text variant="h4">{t('translations')}</Text>
            {isPrivateProject && !canVote && (
              <Icon as={LockIcon} size={18} className="text-muted-foreground" />
            )}
          </View>

          {/* Data Source Toggle */}
          {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
          {SHOW_DEV_ELEMENTS && (
            <View className="flex-row items-center gap-2">
              <Text
                className={`text-sm ${!useOfflineData ? 'text-muted-foreground' : 'text-foreground'}`}
              >
                💾
              </Text>
              <Switch
                checked={!useOfflineData}
                onCheckedChange={(checked: boolean) =>
                  setUseOfflineData(!checked)
                }
              />
              <Text
                className={`text-sm ${useOfflineData ? 'text-muted-foreground' : 'text-foreground'}`}
              >
                🌐
              </Text>
            </View>
          )}
        </View>

        {/* Sort Controls */}
        <View className="flex-row items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onPress={toggleSortOrder}
          >
            <Icon
              as={
                sortOrder === 'asc'
                  ? ArrowUpNarrowWideIcon
                  : ArrowDownWideNarrowIcon
              }
              size={16}
            />
            <Text className="text-sm">
              {sortOrder === 'asc' ? 'A→Z' : 'Z→A'}
            </Text>
          </Button>

          <Button
            variant={sortOption === 'voteCount' ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onPress={() => setSortOption('voteCount')}
          >
            <Icon
              as={ThumbsUpIcon}
              size={16}
              className={
                sortOption === 'voteCount'
                  ? 'text-primary-foreground'
                  : 'text-foreground'
              }
            />
            <Text
              className={`text-sm ${sortOption === 'voteCount' ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              {t('votes')}
            </Text>
          </Button>

          <Button
            variant={sortOption === 'dateSubmitted' ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onPress={() => setSortOption('dateSubmitted')}
          >
            <Icon
              as={CalendarIcon}
              size={16}
              className={
                sortOption === 'dateSubmitted'
                  ? 'text-primary-foreground'
                  : 'text-foreground'
              }
            />
            <Text
              className={`text-sm ${sortOption === 'dateSubmitted' ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              {t('date')}
            </Text>
          </Button>
        </View>
      </View>

      {/* Translations List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center gap-8">
          <ActivityIndicator size="large" color={getThemeColor('primary')} />
        </View>
      ) : (
        <LegendList
          data={assets}
          key={`${assets.length}-${sortOption}-${sortOrder}`}
          keyExtractor={(item) => item.id}
          recycleItems
          estimatedItemSize={120}
          maintainVisibleContentPosition
          contentContainerStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <TranslationCard
              asset={item}
              previewText={getPreviewText(item.text || '')}
              handleTranslationPress={handleTranslationPress}
              audioSegments={getAudioSegments(item)}
            />
          )}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center gap-4 px-8 py-16">
              <Icon
                as={ThumbsUpIcon}
                size={48}
                className="text-muted-foreground/50"
              />
              <Text className="text-center text-lg font-medium text-muted-foreground">
                {t('noTranslationsYet')}
              </Text>
            </View>
          )}
          ListFooterComponent={
            blockedCount > 0
              ? () => (
                  <View className="flex-row items-center justify-center gap-2 py-4">
                    <Icon
                      as={ShieldOffIcon}
                      size={16}
                      className="text-muted-foreground"
                    />
                    <Text className="text-sm text-muted-foreground">
                      {blockedCount}{' '}
                      {blockedCount === 1
                        ? 'blocked translation'
                        : 'blocked translations'}
                    </Text>
                  </View>
                )
              : undefined
          }
        />
      )}

      {/* Translation Modal - Always render, control with open prop */}
      {selectedTranslationId ? (
        <NextGenTranslationModal
          open={open}
          onOpenChange={(newOpen) => {
            setOpen(newOpen);
            if (!newOpen) {
              setSelectedTranslationId(null);
            }
          }}
          assetId={selectedTranslationId}
          onVoteSuccess={handleVoteSuccess}
          canVote={canVote}
          isPrivateProject={isPrivateProject}
          projectId={projectData?.id}
          projectName={projectData?.name}
        />
      ) : null}
    </View>
  );
}
