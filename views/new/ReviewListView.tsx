import { ReviewCard } from '@/components/ReviewCard';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { LegendList } from '@/components/ui/legend-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import type { Review, ReviewsFilter, ReviewTab } from '@/hooks/useReviews';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useReviews } from '@/hooks/useReviews';
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
  return [review.title, review.creatorName, review.origin].some((value) =>
    value.toLowerCase().includes(query)
  );
}

function ReviewsList({
  tab,
  filter,
  searchQuery,
  onOpen
}: {
  tab: ReviewTab;
  filter: ReviewsFilter;
  searchQuery: string;
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
        <ReviewListCard review={item} onOpen={onOpen} />
      )}
      estimatedItemSize={112}
      ItemSeparatorComponent={() => <View className="h-2" />}
      ListEmptyComponent={
        <Text className="py-8 text-center text-muted-foreground">
          No reviews yet
        </Text>
      }
      recycleItems
    />
  );
}

function ReviewListCard({
  review,
  onOpen
}: {
  review: Review;
  onOpen: (review: Review) => void;
}) {
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
          status="draft"
        />
      ) : (
        <ReviewCard
          title={review.title}
          creatorName={review.creatorName}
          date={review.date}
          origin={review.origin}
          status="published"
          outcome={review.outcome}
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
  const [activeTab, setActiveTab] = React.useState<ReviewTab>('in-progress');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Book-level access (BibleChapterList) passes parentQuestId; only a direct
  // quest (BibleAssetsView) can have a review created for it.
  const canAddReview = !!projectId && !!questId && !parentQuestId;
  const filter: ReviewsFilter = { projectId, questId, metadata };

  const openAddReview = () => {
    goToReviewEdit({ projectId, questId, subjectName });
  };

  const openReview = (review: Review) => {
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
          <Button size="sm" onPress={openAddReview}>
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
            onOpen={openReview}
          />
        </TabsContent>
        <TabsContent value="completed" className="min-h-0 flex-1">
          <ReviewsList
            tab="completed"
            filter={filter}
            searchQuery={searchQuery}
            onOpen={openReview}
          />
        </TabsContent>
      </Tabs>
    </View>
  );
}
