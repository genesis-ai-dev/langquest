import { Card, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import { CircleCheckIcon, PlayIcon } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';

/** Cubic ease-out, safe to call inside worklets. */
function easeOutCubic(t: number): number {
  'worklet';
  return 1 - Math.pow(1 - t, 3);
}

const CARD_HEIGHT = 52;
const CONTAINER_PADDING = 12;
const TITLE_HEIGHT = 22;
const INNER_GAP = 8;
const CONTAINER_GAP = 12;
const WAIT_MS = 1000;
const MOVE_MS = 1000;
/** Full loop: wait → move → hold. */
const CYCLE_MS = WAIT_MS + MOVE_MS + WAIT_MS;

/** Height for 1 asset card plus title and padding. */
const CONTAINER_HEIGHT =
  CONTAINER_PADDING * 2 + TITLE_HEIGHT + INNER_GAP + CARD_HEIGHT;

/** Vertical distance from source card top to destination card top. */
const TRAVEL_Y = CONTAINER_HEIGHT + CONTAINER_GAP;

const CARD_TOP = CONTAINER_PADDING + TITLE_HEIGHT + INNER_GAP;

/** Progress landmarks for a single synced timeline (0 → 1). */
const WAIT_END = WAIT_MS / CYCLE_MS; // ~0.333
const MOVE_END = (WAIT_MS + MOVE_MS) / CYCLE_MS; // ~0.666

interface AssetImportAnimationProps {
  className?: string;
}

function DemoAssetCard() {
  return (
    <Card
      className="w-full overflow-hidden border-2 border-secondary bg-primary/10 p-3"
      style={{ height: CARD_HEIGHT }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View className="flex-1 flex-row items-center justify-between gap-1.5">
        <View className="flex-1 flex-row items-center gap-1.5">
          <View className="size-7 items-center justify-center rounded-full bg-primary/20">
            <Icon as={PlayIcon} size={14} className="text-primary/80" />
          </View>
          <CardTitle numberOfLines={1} className="text-sm leading-tight">
            001
          </CardTitle>
        </View>
        <Icon as={CircleCheckIcon} size={20} className="text-primary" />
      </View>
    </Card>
  );
}

function VersionContainer({
  title,
  children
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <View
      className="w-full gap-2 overflow-hidden rounded-xl border border-border bg-muted/30"
      style={{ height: CONTAINER_HEIGHT, padding: CONTAINER_PADDING }}
    >
      <Text
        className="text-sm font-semibold text-foreground"
        style={{ height: TITLE_HEIGHT, lineHeight: TITLE_HEIGHT }}
        numberOfLines={1}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

export function AssetImportAnimation({ className }: AssetImportAnimationProps) {
  const reduceMotion = useReducedMotion();
  // Single clock — opacity and translateY are derived from this, so they can't drift.
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.set(1);
      return;
    }

    progress.set(0);
    progress.set(
      withRepeat(
        withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }),
        -1,
        false
      )
    );
  }, [progress, reduceMotion]);

  const flyingCardStyle = useAnimatedStyle(() => {
    'worklet';
    const p = progress.get();

    // wait [0 → WAIT_END]: hidden at source
    // move [WAIT_END → MOVE_END]: 80% opacity, easeOut travel
    // hold [MOVE_END → 1]: 100% opacity at destination
    let translateY = 0;
    if (p <= WAIT_END) {
      translateY = 0;
    } else if (p < MOVE_END) {
      const moveT = (p - WAIT_END) / (MOVE_END - WAIT_END);
      translateY = TRAVEL_Y * easeOutCubic(moveT);
    } else {
      translateY = TRAVEL_Y;
    }

    const opacity = interpolate(
      p,
      [0, WAIT_END, WAIT_END, MOVE_END, MOVE_END, 1],
      [0, 0, 0.8, 0.8, 1, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }]
    };
  });

  return (
    <View
      className={cn('relative w-full', className)}
      style={{ gap: CONTAINER_GAP }}
      accessibilityLabel="Asset import animation"
      accessibilityRole="image"
    >
      <VersionContainer title="Genesis 1 (v1)">
        <DemoAssetCard />
      </VersionContainer>

      <VersionContainer title="Genesis 1 (v2)">
        {reduceMotion ? <DemoAssetCard /> : null}
      </VersionContainer>

      {!reduceMotion ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: CONTAINER_PADDING,
              right: CONTAINER_PADDING,
              top: CARD_TOP
            },
            flyingCardStyle
          ]}
        >
          <DemoAssetCard />
        </Animated.View>
      ) : null}
    </View>
  );
}
