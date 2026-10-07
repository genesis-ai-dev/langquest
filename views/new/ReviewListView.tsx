import { DownloadConfirmationModal } from '@/components/DownloadConfirmationModal';
import { QuestDownloadDiscoveryDrawer } from '@/components/QuestDownloadDiscoveryDrawer';
import { ReviewCard } from '@/components/ReviewCard';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { LegendList } from '@/components/ui/legend-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { getDraftReviewForQuest } from '@/database_services/reviewService';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import {
  getDiscoveredCounts,
  useQuestDownloadDiscovery
} from '@/hooks/useQuestDownloadDiscovery';
import type { Review, ReviewsFilter, ReviewTab } from '@/hooks/useReviews';
import { useReviews } from '@/hooks/useReviews';
import { syncCallbackService } from '@/services/syncCallbackService';
import { bulkDownloadQuest } from '@/utils/bulkDownload';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardPlusIcon, SearchIcon } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

interface ReviewListViewProps {
  subjectName?: string;
  parentQuestId?: string;
  projectId?: string;
  questId?: string;
  /** Review metadata to match (e.g. { bible: { book } }); replaces the quest filter. */
  metadata?: Record<string, unknown>;
}

function matchesSearch(review: Review, query: string) {
  if (!query) return true;
  return [review.title, review.creatorName, review.reviewLabel, review.origin]
    .filter((value) => value != null)
    .some((value) => value.toLowerCase().includes(query));
}

function ReviewsList({
  tab,
  filter,
  searchQuery,
  downloadingQuestIds,
  onOpen
}: {
  tab: ReviewTab;
  filter: ReviewsFilter;
  searchQuery: string;
  downloadingQuestIds: Set<string>;
  onOpen: (review: Review) => void;
}) {
  const { reviews, isLoading } = useReviews(tab, filter);
  const query = searchQuery.trim().toLowerCase();
  const visibleReviews = reviews.filter((review) =>
    matchesSearch(review, query)
  );

  if (isLoading) {
    return (
      <View className="items-center py-8">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <LegendList
      data={visibleReviews}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ReviewListCard
          review={item}
          isDownloading={downloadingQuestIds.has(item.questId)}
          onOpen={onOpen}
        />
      )}
      estimatedItemSize={112}
      ItemSeparatorComponent={() => <View className="h-2" />}
      ListEmptyComponent={
        <Text className="py-8 text-center text-muted-foreground">
          {tab === 'in-progress'
            ? 'No reviews in progress'
            : 'No completed reviews yet'}
        </Text>
      }
      recycleItems
    />
  );
}

function ReviewListCard({
  review,
  isDownloading,
  onOpen
}: {
  review: Review;
  isDownloading: boolean;
  onOpen: (review: Review) => void;
}) {
  const downloadProps = {
    needsDownload: review.needsDownload,
    isDownloading,
    onDownloadPress: () => onOpen(review)
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(review)}
      className="active:opacity-70"
    >
      {review.status === 'draft' ? (
        <ReviewCard
          title={review.title}
          creatorName={review.creatorName}
          date={review.date}
          origin={review.origin}
          reviewLabel={review.reviewLabel}
          status="draft"
          inactive={!review.active}
        />
      ) : (
        <ReviewCard
          title={review.title}
          creatorName={review.creatorName}
          date={review.date}
          origin={review.origin}
          reviewLabel={review.reviewLabel}
          status="published"
          outcome={review.outcome}
          inactive={!review.active}
          {...downloadProps}
        />
      )}
    </Pressable>
  );
}

export default function ReviewListView({
  subjectName,
  parentQuestId,
  projectId,
  questId,
  metadata
}: ReviewListViewProps) {
  const { goToReviewEdit, goToReviewResult } = useNavigationHelpers();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = React.useState<ReviewTab>('completed');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Book-level access (BibleChapterList) passes parentQuestId; only a direct
  // quest (BibleAssetsView) can have a review created for it.
  const canAddReview = !!projectId && !!questId && !parentQuestId;
  const filter: ReviewsFilter = { projectId, questId, metadata };

  const openAddReview = async () => {
    if (!projectId || !questId || !currentUser?.id) return;
    const existing = await getDraftReviewForQuest(questId, currentUser.id);
    goToReviewEdit({
      projectId,
      questId,
      subjectName,
      ...(existing ? { reviewId: existing.id } : { promptReviewLabel: true })
    });
  };

  const queryClient = useQueryClient();
  const [questIdToDownload, setQuestIdToDownload] = React.useState<
    string | null
  >(null);
  const [showDiscoveryDrawer, setShowDiscoveryDrawer] = React.useState(false);
  const [showConfirmationModal, setShowConfirmationModal] =
    React.useState(false);
  const [downloadingQuestIds, setDownloadingQuestIds] = React.useState<
    Set<string>
  >(new Set());

  const discoveryState = useQuestDownloadDiscovery(questIdToDownload ?? '');
  const startedDiscoveryRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (
      showDiscoveryDrawer &&
      questIdToDownload &&
      !discoveryState.isDiscovering &&
      startedDiscoveryRef.current !== questIdToDownload
    ) {
      startedDiscoveryRef.current = questIdToDownload;
      discoveryState.startDiscovery();
    }
    if (!showDiscoveryDrawer) {
      startedDiscoveryRef.current = null;
    }
  }, [showDiscoveryDrawer, questIdToDownload, discoveryState]);

  const stopTrackingDownload = (downloadQuestId: string) => {
    setDownloadingQuestIds((prev) => {
      const next = new Set(prev);
      next.delete(downloadQuestId);
      return next;
    });
  };

  const downloadMutation = useMutation({
    mutationFn: async (downloadQuestId: string) => {
      if (!currentUser?.id) throw new Error('Missing user');
      await bulkDownloadQuest(discoveryState.discoveredIds, currentUser.id);
      return downloadQuestId;
    },
    onSuccess: (downloadQuestId) => {
      // The review leaves the cloud list once PowerSync delivers the quest.
      syncCallbackService.registerCallback(downloadQuestId, async () => {
        stopTrackingDownload(downloadQuestId);
        await queryClient.invalidateQueries({
          queryKey: ['reviews', 'cloud']
        });
      });
    }
  });

  const startDownload = (downloadQuestId: string) => {
    setQuestIdToDownload(downloadQuestId);
    setShowDiscoveryDrawer(true);
  };

  // Closing the discovery drawer to continue also fires onOpenChange(false),
  // so the quest being confirmed must survive that cancel.
  const confirmingQuestIdRef = React.useRef<string | null>(null);

  const handleDiscoveryContinue = () => {
    confirmingQuestIdRef.current = questIdToDownload;
    setShowDiscoveryDrawer(false);
    setShowConfirmationModal(true);
  };

  const handleCancelDiscovery = () => {
    setShowDiscoveryDrawer(false);
    if (confirmingQuestIdRef.current) return;
    discoveryState.cancel();
    setQuestIdToDownload(null);
  };

  const handleConfirmDownload = async () => {
    setShowConfirmationModal(false);
    const downloadQuestId = confirmingQuestIdRef.current;
    confirmingQuestIdRef.current = null;
    if (!downloadQuestId) return;
    setDownloadingQuestIds((prev) => new Set(prev).add(downloadQuestId));
    try {
      await downloadMutation.mutateAsync(downloadQuestId);
    } catch (error) {
      console.error('Failed to download quest for review:', error);
      stopTrackingDownload(downloadQuestId);
    } finally {
      setQuestIdToDownload(null);
    }
  };

  const handleCancelConfirmation = () => {
    confirmingQuestIdRef.current = null;
    setShowConfirmationModal(false);
    setQuestIdToDownload(null);
  };

  const openReview = (review: Review) => {
    if (review.needsDownload) {
      if (!downloadingQuestIds.has(review.questId)) {
        startDownload(review.questId);
      }
      return;
    }
    const target = {
      projectId,
      questId: review.questId,
      reviewId: review.id
    };
    if (review.status === 'draft') {
      goToReviewEdit({ ...target, subjectName: review.title });
    } else {
      goToReviewResult(target);
    }
  };

  return (
    <View className="flex-1 flex-col gap-6 px-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-col items-start">
          <Text variant="h3" className="w-full text-left">
            Reviews
          </Text>
          {subjectName ? (
            <Text className="w-full text-left text-sm text-muted-foreground">
              {subjectName}
            </Text>
          ) : null}
        </View>
        {canAddReview ? (
          <Button
            size="sm"
            onPress={() => {
              void openAddReview();
            }}
          >
            <Icon as={ClipboardPlusIcon} size={16} />
            <Text>Add Review</Text>
          </Button>
        ) : null}
      </View>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ReviewTab)}
        className="min-h-0 flex-1"
      >
        <TabsList className="w-full">
          <TabsTrigger value="in-progress">
            <Text>In Progress</Text>
          </TabsTrigger>
          <TabsTrigger value="completed">
            <Text>Completed</Text>
          </TabsTrigger>
        </TabsList>

        <Input
          placeholder="Search"
          value={searchQuery}
          onChangeText={setSearchQuery}
          prefix={SearchIcon}
          prefixStyling={false}
          size="sm"
          returnKeyType="search"
        />

        <TabsContent value="in-progress" className="min-h-0 flex-1">
          <ReviewsList
            tab="in-progress"
            filter={filter}
            searchQuery={searchQuery}
            downloadingQuestIds={downloadingQuestIds}
            onOpen={openReview}
          />
        </TabsContent>
        <TabsContent value="completed" className="min-h-0 flex-1">
          <ReviewsList
            tab="completed"
            filter={filter}
            searchQuery={searchQuery}
            downloadingQuestIds={downloadingQuestIds}
            onOpen={openReview}
          />
        </TabsContent>
      </Tabs>

      <QuestDownloadDiscoveryDrawer
        isOpen={showDiscoveryDrawer}
        onOpenChange={(open) => {
          if (!open) handleCancelDiscovery();
        }}
        onContinue={handleDiscoveryContinue}
        discoveryState={discoveryState}
      />

      <DownloadConfirmationModal
        visible={showConfirmationModal}
        onConfirm={handleConfirmDownload}
        onCancel={handleCancelConfirmation}
        downloadType="quest"
        discoveredCounts={getDiscoveredCounts(discoveryState)}
      />
    </View>
  );
}
