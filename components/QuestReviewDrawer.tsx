import { AudioPlayerControls } from '@/components/AudioPlayerControls';
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
import { getReviewAudio } from '@/database_services/reviewService';
import type { AssetResult } from '@/database_services/reviewService';
import { profile, review } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { resolveExistingAudioUri } from '@/utils/attachmentPaths';
import { formatRelativeDate } from '@/utils/dateUtils';
import { getThemeColor } from '@/utils/styleUtils';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import { PlayIcon } from 'lucide-react-native';
import type { Ref } from 'react';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DRAWER_SNAP_POINTS = ['60%'];
const HANDLE_HEIGHT = 24;
const BOTTOM_GAP = 16;
const SEEK_STEP_MS = 5000;
const PLAYER_SLOT_HEIGHT = 120;

export interface QuestReviewDrawerHandle {
  open: (reviewId: string, label?: string) => void;
}

interface QuestReviewDetail {
  id: string;
  result: AssetResult;
  conclusion: string | null;
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

function audioValues(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.length > 0);
}

function drawerAudioId(reviewId: string) {
  return `quest-review-drawer-${reviewId}`;
}

function preferSynced(rows: QuestReviewDetail[]): QuestReviewDetail | null {
  return rows.find((row) => row.source === 'synced') ?? rows[0] ?? null;
}

async function fetchQuestReview(
  reviewId: string
): Promise<QuestReviewDetail | null> {
  const rows = await system.db
    .select({
      id: review.id,
      result: review.quest_result,
      conclusion: review.conclusion,
      metadata: review.metadata,
      audio: review.audio,
      concludedAt: review.concluded_at,
      lastUpdated: review.last_updated,
      source: review.source,
      username: profile.username
    })
    .from(review)
    .leftJoin(profile, eq(profile.id, review.profile_id))
    .where(eq(review.id, reviewId));

  return preferSynced(
    rows.map((row) => ({
      id: row.id,
      result: toAssetResult(row.result),
      conclusion: row.conclusion?.trim() ? row.conclusion : null,
      audio: audioValues(
        row.audio?.length
          ? row.audio
          : getReviewAudio({ metadata: row.metadata })
      ),
      username: row.username?.trim() || 'Unknown',
      createdAt: row.concludedAt ?? row.lastUpdated,
      source: row.source
    }))
  );
}

/** Stops drawer audio when the drawer closes, without a floating player. */
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

function QuestReviewPlayer({
  audioId,
  audioValues,
  title
}: {
  audioId: string;
  audioValues: string[];
  title: string;
}) {
  const audio = useAudio();
  const [visible, setVisible] = useState(false);
  const isActive =
    audio.currentAudioId === audioId && (audio.isPlaying || audio.isPaused);

  const seekBy = (deltaMs: number) => {
    const duration = Math.max(0, audio.duration);
    const target = audio.position + deltaMs;
    void audio.setPosition(
      duration > 0
        ? Math.max(0, Math.min(target, duration))
        : Math.max(0, target)
    );
  };

  const start = async () => {
    const uris = (
      await Promise.all(
        audioValues.map((value) => resolveExistingAudioUri(value))
      )
    ).filter((uri): uri is string => !!uri);
    if (!uris.length) return;
    if (uris.length === 1 && uris[0]) {
      await audio.playSound(uris[0], audioId);
    } else {
      await audio.playSoundSequence(uris, audioId);
    }
    setVisible(true);
  };

  return (
    <View
      style={{ height: PLAYER_SLOT_HEIGHT }}
      className="justify-center overflow-hidden"
    >
      {visible && isActive ? (
        <AudioPlayerControls
          mode="individual"
          position="inline"
          className="bg-card"
          currentAssetName={title}
          isPlaying={audio.isPlaying}
          isPaused={audio.isPaused}
          positionShared={audio.positionShared}
          durationShared={audio.durationShared}
          onRewind={() => seekBy(-SEEK_STEP_MS)}
          onForward={() => seekBy(SEEK_STEP_MS)}
          onPlayPause={() =>
            void (audio.isPlaying ? audio.pauseSound() : audio.resumeSound())
          }
          onStop={() => {
            setVisible(false);
            void audio.stopCurrentSound();
          }}
        />
      ) : (
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full"
          accessibilityLabel="Play"
          onPress={() => void start()}
        >
          <Icon as={PlayIcon} size={16} />
        </Button>
      )}
    </View>
  );
}

function QuestReviewDrawerBody({
  reviewId,
  label
}: {
  reviewId: string;
  label?: string;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const drawerHeight = Math.max(
    240,
    Math.round(
      (windowHeight - topInset - bottomInset) * 0.6 - HANDLE_HEIGHT - BOTTOM_GAP
    )
  );
  const detailQuery = useQuery({
    queryKey: ['quest-review-drawer', reviewId],
    queryFn: () => fetchQuestReview(reviewId)
  });
  const detail = detailQuery.data ?? null;
  const reviewLabel = label?.trim() || undefined;

  return (
    <View
      style={{ height: drawerHeight }}
      className="gap-3 overflow-hidden"
      data-slot="quest-review-drawer"
    >
      <ReleaseDrawerAudio audioId={drawerAudioId(reviewId)} />
      <DrawerHeader className="flex-row items-baseline gap-2 py-0">
        <DrawerTitle>Review</DrawerTitle>
        {reviewLabel ? (
          <Text
            className="min-w-0 flex-1 text-sm text-muted-foreground"
            numberOfLines={1}
          >
            {reviewLabel}
          </Text>
        ) : null}
      </DrawerHeader>
      <View className="flex-row items-center justify-between gap-3">
        <Text
          className="min-w-0 flex-1 text-sm text-muted-foreground"
          numberOfLines={1}
        >
          {detail
            ? `${detail.username}${
                detail.createdAt
                  ? ` · ${formatRelativeDate(detail.createdAt)}`
                  : ''
              }`
            : ''}
        </Text>
        {detail ? <ResultBadge result={detail.result} /> : null}
      </View>
      {detailQuery.isLoading ? (
        <ActivityIndicator color={getThemeColor('primary')} />
      ) : detail ? (
        <ScrollView
          className="min-h-0 flex-1 rounded-lg border border-border bg-muted"
          nestedScrollEnabled
        >
          <View className="p-3">
            <Text className="text-sm leading-5">
              {detail.conclusion ??
                (detail.audio.length > 0 ? 'Audio feedback only' : '')}
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View className="min-h-0 flex-1 justify-center rounded-lg border border-border bg-muted p-3">
          <Text className="text-sm text-muted-foreground">
            Review not found
          </Text>
        </View>
      )}
      {detail && detail.audio.length > 0 ? (
        <QuestReviewPlayer
          audioId={drawerAudioId(detail.id)}
          audioValues={detail.audio}
          title={reviewLabel ?? 'Review'}
        />
      ) : null}
    </View>
  );
}

export function QuestReviewDrawer({
  ref
}: {
  ref?: Ref<QuestReviewDrawerHandle | null>;
}) {
  const [target, setTarget] = useState<{
    reviewId: string;
    label?: string;
  } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      open(reviewId, label) {
        setTarget({ reviewId, label });
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
            <QuestReviewDrawerBody
              key={target.reviewId}
              reviewId={target.reviewId}
              label={target.label}
            />
          ) : (
            <View />
          )}
        </DrawerView>
      </DrawerContent>
    </Drawer>
  );
}
