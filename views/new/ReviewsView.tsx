import { ReviewCard } from '@/components/ReviewCard';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { LegendList } from '@/components/ui/legend-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import type { Review, ReviewTab } from '@/hooks/useReviews';
import { useReviews } from '@/hooks/useReviews';
import {  useRouter } from 'expo-router';
import type {Href} from 'expo-router';
import { ClipboardPlusIcon, SearchIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

interface ReviewsViewProps {
  subjectName?: string;
  parentQuestId?: string;
  projectId?: string;
  questId?: string;
}

function ReviewsList({ tab }: { tab: ReviewTab }) {
  const { reviews } = useReviews(tab);

  return (
    <LegendList
      data={reviews}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ReviewListCard review={item} />}
      estimatedItemSize={112}
      ItemSeparatorComponent={() => <View className="h-2" />}
      recycleItems
    />
  );
}

function ReviewListCard({ review }: { review: Review }) {
  if (review.status === 'draft') {
    return (
      <ReviewCard
        title={review.title}
        creatorName={review.creatorName}
        date={review.date}
        origin={review.origin}
        status="draft"
      />
    );
  }

  return (
    <ReviewCard
      title={review.title}
      creatorName={review.creatorName}
      date={review.date}
      origin={review.origin}
      status="published"
      outcome={review.outcome}
    />
  );
}

export default function ReviewsView({
  subjectName,
  parentQuestId,
  projectId,
  questId
}: ReviewsViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<ReviewTab>('in-progress');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Book-level access (BibleChapterList) passes parentQuestId; only a direct
  // quest (BibleAssetsView) can have a review created for it.
  const canAddReview = !!projectId && !!questId && !parentQuestId;

  const openAddReview = () => {
    router.push({
      pathname: '/(app)/project/[projectId]/quest/[questId]/review-edit',
      params: { projectId, questId, subjectName }
    } as Href);
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
          <ReviewsList tab="in-progress" />
        </TabsContent>
        <TabsContent value="completed" className="min-h-0 flex-1">
          <ReviewsList tab="completed" />
        </TabsContent>
      </Tabs>
    </View>
  );
}
