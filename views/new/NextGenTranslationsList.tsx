import { TranslationCard } from '@/components/TranslationCard';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useStatusContext } from '@/contexts/StatusContext';
import { system } from '@/db/powersync/system';
import type { TranslationWithVoteCount } from '@/hooks/db/useTranslations';
import { useTranslationsWithVoteCountByAssetId } from '@/hooks/db/useTranslations';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import type { MembershipRole } from '@/hooks/useUserPermissions';
import type { SortOrder, WithSource } from '@/utils/dbUtils';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { getThemeColor } from '@/utils/styleUtils';
import { LegendList } from '@legendapp/list';
import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  CalendarIcon,
  ThumbsUpIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import NextGenTranslationModal from './NextGenTranslationModalAlt';

interface NextGenTranslationsListProps {
  assetId: string;
  assetName?: string;
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
  const [sortOption, setSortOption] = useState<SortOption>('voteCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedTranslationId, setSelectedTranslationId] = useState<
    string | null
  >(null);
  const [voteRefreshKey, setVoteRefreshKey] = useState(0);

  const _currentLayer = useStatusContext();

  const {
    data: translations,
    isLoading,
    hasError: _hasError
  } = useTranslationsWithVoteCountByAssetId(
    assetId,
    false, // showInvisibleContent - using false as default since property doesn't exist
    String(refreshKey),
    String(voteRefreshKey),
    useOfflineData,
    sortOption,
    sortOrder
  );

  // Use props from parent if available, otherwise default behavior
  const isPrivateProject = projectData?.private || false;
  const canVote = canVoteProp !== undefined ? canVoteProp : !isPrivateProject;

  // Collect audio IDs for attachment states
  const audioIds = React.useMemo(() => {
    return translations
      .filter((trans) => trans.audio)
      .map((trans) => trans.audio!)
      .filter(Boolean);
  }, [translations]);

  const { attachmentStates, isLoading: _isLoadingAttachments } =
    useAttachmentStates(audioIds);

  const getPreviewText = (fullText: string, maxLength = 50) => {
    if (!fullText) return '(Empty translation)';
    if (fullText.length <= maxLength) return fullText;
    return fullText.substring(0, maxLength).trim() + '...';
  };

  const getAudioUri = (translation: WithSource<TranslationWithVoteCount>) => {
    if (!translation.audio) return undefined;
    const localUri = attachmentStates.get(translation.audio)?.local_uri;
    return localUri
      ? system.permAttachmentQueue?.getLocalUri(localUri)
      : undefined;
  };

  const handleTranslationPress = (translationId: string) => {
    // Always allow opening modal - voting restrictions are handled inside the modal
    setSelectedTranslationId(translationId);
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
      <View className="flex-col gap-4 py-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="h4">
            {t('translations')}
            {isPrivateProject && !canVote && (
              <Text className="text-base"> 🔒</Text>
            )}
          </Text>

          {/* Data Source Toggle */}
          {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
          {SHOW_DEV_ELEMENTS && (
            <View className="flex-row items-center gap-2">
              <Text
                className={`text-base ${!useOfflineData ? 'opacity-30' : ''}`}
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
                className={`text-base ${useOfflineData ? 'opacity-30' : ''}`}
              >
                🌐
              </Text>
            </View>
          )}

          <View className="flex-row gap-2">
            <Button
              variant="outline"
              size="icon"
              className="p-2"
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
            </Button>
            <Button
              variant={sortOption === 'voteCount' ? 'default' : 'outline'}
              size="icon"
              className="p-2"
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
            </Button>
            <Button
              variant={sortOption === 'dateSubmitted' ? 'default' : 'outline'}
              size="icon"
              className="p-2"
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
            </Button>
          </View>
        </View>
      </View>

      {/* Translations List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center gap-8">
          <ActivityIndicator size="large" color={getThemeColor('primary')} />
        </View>
      ) : (
        <LegendList
          data={translations}
          key={`${translations.length}-${sortOption}-${sortOrder}`}
          keyExtractor={(item) => item.id}
          recycleItems
          estimatedItemSize={120}
          maintainVisibleContentPosition
          renderItem={({ item }) => (
            <TranslationCard
              translation={item}
              previewText={getPreviewText(item.text || '')}
              handleTranslationPress={handleTranslationPress}
              audioUri={getAudioUri(item)}
            />
          )}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center gap-8">
              <Text className="text-center text-muted-foreground">
                {t('noTranslationsYet')}
              </Text>
            </View>
          )}
        />
      )}

      {/* Translation Modal */}
      {selectedTranslationId && (
        <NextGenTranslationModal
          visible={!!selectedTranslationId}
          onClose={() => setSelectedTranslationId(null)}
          translationId={selectedTranslationId}
          onVoteSuccess={handleVoteSuccess}
          canVote={canVote}
          isPrivateProject={isPrivateProject}
          projectId={projectData?.id}
          projectName={projectData?.name}
        />
      )}
    </View>
  );
}
