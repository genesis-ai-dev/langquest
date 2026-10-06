import { ResultBadge } from '@/components/ReviewResult';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerView
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAudio } from '@/contexts/AudioContext';
import type { AssetResult } from '@/database_services/reviewService';
import { profile, review, review_asset } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { resolveExistingAudioUri } from '@/utils/attachmentPaths';
import { formatRelativeDate } from '@/utils/dateUtils';
import { cn, getThemeColor } from '@/utils/styleUtils';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import { PauseIcon, PlayIcon, StarIcon } from 'lucide-react-native';
import type { Ref } from 'react';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DRAWER_SNAP_POINTS = ['70%'];
const TEXT_BOX_HEIGHT = 120;
const HANDLE_HEIGHT = 24;
const BOTTOM_GAP = 24;

export interface AssetReviewDrawerHandle {
  open: (assetId: string, reviewAssetId: string) => void;
}

interface AssetReviewItem {
  id: string;
  reviewId: string;
  result: AssetResult;
  comment: string | null;
  audio: string[];
  username: string;
  createdAt: string;
  source: string;
}

function toAssetResult(value: string | null): AssetResult {
  if (
    value === 'suggested_changes' ||
    value === 'approved' ||
    value === 'not_reviewed'
  ) {
    return value;
  }
  return 'not_reviewed';
}

function audioValues(value: string[] | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.length > 0);
}

function drawerAudioId(reviewAssetId: string) {
  return `review-drawer-${reviewAssetId}`;
}

function preferSynced(rows: AssetReviewItem[]): AssetReviewItem[] {
  const byReview = new Map<string, AssetReviewItem>();
  for (const row of rows) {
    const existing = byReview.get(row.reviewId);
    if (existing?.source === 'synced') continue;
    byReview.set(row.reviewId, row);
  }
  return [...byReview.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

async function fetchAssetReviewById(
  reviewAssetId: string
): Promise<AssetReviewItem | null> {
  const rows = await system.db
    .select({
      id: review_asset.id,
      reviewId: review_asset.review_id,
      result: review_asset.asset_result,
      comment: review_asset.comment,
      audio: review_asset.audio,
      createdAt: review.created_at,
      assetCreatedAt: review_asset.created_at,
      source: review_asset.source,
      username: profile.username
    })
    .from(review_asset)
    .leftJoin(review, eq(review.id, review_asset.review_id))
    .leftJoin(profile, eq(profile.id, review.profile_id))
    .where(eq(review_asset.id, reviewAssetId));

  const items = preferSynced(rows.map(toAssetReviewItem));
  return items[0] ?? null;
}

async function fetchAssetReviews(assetId: string): Promise<AssetReviewItem[]> {
  const rows = await system.db
    .select({
      id: review_asset.id,
      reviewId: review_asset.review_id,
      result: review_asset.asset_result,
      comment: review_asset.comment,
      audio: review_asset.audio,
      createdAt: review.created_at,
      assetCreatedAt: review_asset.created_at,
      source: review_asset.source,
      username: profile.username
    })
    .from(review_asset)
    .leftJoin(review, eq(review.id, review_asset.review_id))
    .leftJoin(profile, eq(profile.id, review.profile_id))
    .where(eq(review_asset.asset_id, assetId));

  return preferSynced(rows.map(toAssetReviewItem));
}

function toAssetReviewItem(row: {
  id: string;
  reviewId: string;
  result: string | null;
  comment: string | null;
  audio: string[] | null;
  createdAt: string | null;
  assetCreatedAt: string;
  source: string;
  username: string | null;
}): AssetReviewItem {
  return {
    id: row.id,
    reviewId: row.reviewId,
    result: toAssetResult(row.result),
    comment: row.comment?.trim() ? row.comment : null,
    audio: audioValues(row.audio),
    username: row.username?.trim() || 'Unknown',
    createdAt: row.createdAt ?? row.assetCreatedAt,
    source: row.source
  };
}

function DrawerAudioButton({
  audioId,
  audioValues
}: {
  audioId: string;
  audioValues: string[];
}) {
  const {
    playSound,
    pauseSound,
    resumeSound,
    isPlaying,
    isPaused,
    currentAudioId
  } = useAudio();
  const isActive = currentAudioId === audioId && (isPlaying || isPaused);
  const isThisPlaying = isActive && isPlaying;

  const toggle = async () => {
    if (isThisPlaying) {
      await pauseSound();
      return;
    }
    if (isActive) {
      await resumeSound();
      return;
    }
    const uris = (
      await Promise.all(
        audioValues.map((value) => resolveExistingAudioUri(value))
      )
    ).filter((uri): uri is string => !!uri);
    const uri = uris[0];
    if (uri) await playSound(uri, audioId);
  };

  return (
    <Button
      variant="secondary"
      size="icon"
      className="rounded-full"
      accessibilityLabel={isThisPlaying ? 'Pause' : 'Play'}
      onPress={() => void toggle()}
    >
      <Icon as={isThisPlaying ? PauseIcon : PlayIcon} size={16} />
    </Button>
  );
}

/** Stops drawer audio when this review is left, without a floating player. */
function ReleaseDrawerAudio({ audioId }: { audioId: string }) {
  const { currentAudioId, stopCurrentSound } = useAudio();
  const currentIdRef = useRef(currentAudioId);
  const stopRef = useRef(stopCurrentSound);

  useEffect(() => {
    currentIdRef.current = currentAudioId;
    stopRef.current = stopCurrentSound;
  });

  useEffect(() => {
    return () => {
      if (currentIdRef.current === audioId) {
        void stopRef.current();
      }
    };
  }, [audioId]);

  return null;
}

function AssetReviewDrawerBody({
  assetId,
  reviewAssetId
}: {
  assetId: string;
  reviewAssetId: string;
}) {
  const [selectedId, setSelectedId] = useState(reviewAssetId);
  const [showList, setShowList] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  // The sheet snaps to 70% of the area between the safe-area insets, and the
  // drag handle takes the first HANDLE_HEIGHT of that.
  const drawerHeight = Math.max(
    280,
    Math.round(
      (windowHeight - topInset - bottomInset) * 0.7 - HANDLE_HEIGHT - BOTTOM_GAP
    )
  );
  const zoneHeight = Math.round(drawerHeight / 2);

  const detailQuery = useQuery({
    queryKey: ['asset-review-drawer', reviewAssetId],
    queryFn: () => fetchAssetReviewById(reviewAssetId)
  });
  const listQuery = useQuery({
    queryKey: ['asset-review-drawer-list', assetId],
    queryFn: () => fetchAssetReviews(assetId),
    enabled: showList
  });

  const selected =
    selectedId === reviewAssetId
      ? (detailQuery.data ?? null)
      : (listQuery.data?.find((item) => item.id === selectedId) ?? null);
  const initialReviewId = detailQuery.data?.reviewId;
  const isInitialReview = (item: AssetReviewItem) =>
    item.id === reviewAssetId || item.reviewId === initialReviewId;
  const listItems = listQuery.data
    ? [
        ...listQuery.data.filter(isInitialReview),
        ...listQuery.data.filter((item) => !isInitialReview(item))
      ]
    : undefined;

  const selectReview = (item: AssetReviewItem) => {
    setSelectedId(item.id);
  };

  return (
    <View
      style={{ height: drawerHeight }}
      className="overflow-hidden"
      data-slot="asset-review-drawer"
    >
      <View style={{ height: zoneHeight }} className="gap-3 overflow-hidden">
        <DrawerHeader className="py-0">
          <DrawerTitle>Review</DrawerTitle>
        </DrawerHeader>
        <View className="flex-row items-center justify-between gap-3">
          <Text
            className="min-w-0 flex-1 text-sm text-muted-foreground"
            numberOfLines={1}
          >
            {selected
              ? `${selected.username}${
                  selected.createdAt
                    ? ` · ${formatRelativeDate(selected.createdAt)}`
                    : ''
                }`
              : ''}
          </Text>
          {selected ? <ResultBadge result={selected.result} /> : null}
        </View>
        {detailQuery.isLoading ? (
          <ActivityIndicator color={getThemeColor('primary')} />
        ) : selected ? (
          <ScrollView
            style={{ height: TEXT_BOX_HEIGHT }}
            className="rounded-lg border border-border bg-muted"
            nestedScrollEnabled
          >
            <View className="p-3">
              <Text className="text-sm leading-5">
                {selected.comment ?? ''}
              </Text>
            </View>
          </ScrollView>
        ) : (
          <View
            style={{ height: TEXT_BOX_HEIGHT }}
            className="justify-center rounded-lg border border-border bg-muted p-3"
          >
            <Text className="text-sm text-muted-foreground">
              Review not found
            </Text>
          </View>
        )}
        <View className="h-10 flex-row items-center">
          {selected && selected.audio.length > 0 ? (
            <>
              <ReleaseDrawerAudio audioId={drawerAudioId(selected.id)} />
              <DrawerAudioButton
                audioId={drawerAudioId(selected.id)}
                audioValues={selected.audio}
              />
            </>
          ) : null}
        </View>
      </View>

      <View style={{ height: zoneHeight }} className="gap-3 pt-3">
        <View className="h-px bg-border" />
        {showList ? (
          <View className="min-h-0 flex-1 gap-2">
            <Text className="font-semibold">Reviews list</Text>
            {listQuery.isLoading ? (
              <ActivityIndicator color={getThemeColor('primary')} />
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                <View className="gap-2">
                  {listItems?.map((item) => {
                    const isInitial = isInitialReview(item);
                    const isSelected = item.id === selectedId;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => selectReview(item)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        className={cn(
                          'flex-row items-center justify-between gap-3 rounded-lg border border-border px-3 py-2',
                          isSelected && 'border-primary bg-primary/10'
                        )}
                      >
                        <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
                          {isInitial ? (
                            <Icon
                              as={StarIcon}
                              size={14}
                              className="fill-yellow-500 text-yellow-500"
                              accessibilityLabel="Main review"
                            />
                          ) : null}
                          <Text
                            className="min-w-0 shrink text-sm font-semibold"
                            numberOfLines={1}
                          >
                            {item.username}
                          </Text>
                        </View>
                        <Text className="text-sm text-muted-foreground">
                          {item.createdAt
                            ? formatRelativeDate(item.createdAt)
                            : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-full rounded-full"
            onPress={() => setShowList(true)}
          >
            <Text>See other reviews</Text>
          </Button>
        )}
      </View>
    </View>
  );
}

export function AssetReviewDrawer({
  ref
}: {
  ref?: Ref<AssetReviewDrawerHandle | null>;
}) {
  const [target, setTarget] = useState<{
    assetId: string;
    reviewAssetId: string;
  } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      open(assetId, reviewAssetId) {
        setTarget({ assetId, reviewAssetId });
      }
    }),
    []
  );

  return (
    <Drawer
      open={target != null}
      onOpenChange={(next) => {
        if (!next) setTarget(null);
      }}
      snapPoints={DRAWER_SNAP_POINTS}
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
    >
      <DrawerContent asChild>
        <DrawerView className="overflow-hidden bg-card">
          {target ? (
            <AssetReviewDrawerBody
              key={target.reviewAssetId}
              assetId={target.assetId}
              reviewAssetId={target.reviewAssetId}
            />
          ) : (
            <View />
          )}
        </DrawerView>
      </DrawerContent>
    </Drawer>
  );
}
