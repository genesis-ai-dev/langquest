/**
 * useRecordingState - Manages recording lifecycle and pending segments
 *
 * Handles:
 * - Recording start/stop state
 * - Pending segment tracking
 * - Optimistic pending cards with animations
 */

import React from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import uuid from 'react-native-uuid';

export type PendingStatus = 'recording' | 'saving' | 'ready' | 'error';

export interface PendingSegment {
  tempId: string;
  id?: string;
  name: string;
  status: PendingStatus;
  placementIndex: number;
  duration?: number;
  uri?: string;
  createdAt: number;
}

interface UseRecordingStateReturn {
  isRecording: boolean;
  pendingSegments: PendingSegment[];
  pendingAnimsRef: React.MutableRefObject<
    Map<
      string,
      {
        opacity: ReturnType<typeof useSharedValue<number>>;
        translateY: ReturnType<typeof useSharedValue<number>>;
      }
    >
  >;
  startRecording: (insertionIndex: number) => string;
  createPendingCard: (insertionIndex: number, name?: string) => string; // Create pending card without starting recording
  stopRecording: () => void;
  removePending: (tempId?: string | null) => void;
}

// ✅ FIX 1: Pre-create a pool of shared values at top level

export function useRecordingState(): UseRecordingStateReturn {
  const [isRecording, setIsRecording] = React.useState(false);
  const [pendingSegments, setPendingSegments] = React.useState<
    PendingSegment[]
  >([]);

  // ✅ GOOD: Pre-create animation shared values at top level (not in callbacks!)
  // Create all shared values at the top level (hooks must be called unconditionally)
  const opacity0 = useSharedValue(0);
  const translateY0 = useSharedValue(12);
  const opacity1 = useSharedValue(0);
  const translateY1 = useSharedValue(12);
  const opacity2 = useSharedValue(0);
  const translateY2 = useSharedValue(12);
  const opacity3 = useSharedValue(0);
  const translateY3 = useSharedValue(12);
  const opacity4 = useSharedValue(0);
  const translateY4 = useSharedValue(12);
  const opacity5 = useSharedValue(0);
  const translateY5 = useSharedValue(12);
  const opacity6 = useSharedValue(0);
  const translateY6 = useSharedValue(12);
  const opacity7 = useSharedValue(0);
  const translateY7 = useSharedValue(12);
  const opacity8 = useSharedValue(0);
  const translateY8 = useSharedValue(12);
  const opacity9 = useSharedValue(0);
  const translateY9 = useSharedValue(12);

  // Store them in a stable array using useRef
  const animationPool = React.useRef([
    { opacity: opacity0, translateY: translateY0, metadata: { inUse: false, id: null as string | null } },
    { opacity: opacity1, translateY: translateY1, metadata: { inUse: false, id: null as string | null } },
    { opacity: opacity2, translateY: translateY2, metadata: { inUse: false, id: null as string | null } },
    { opacity: opacity3, translateY: translateY3, metadata: { inUse: false, id: null as string | null } },
    { opacity: opacity4, translateY: translateY4, metadata: { inUse: false, id: null as string | null } },
    { opacity: opacity5, translateY: translateY5, metadata: { inUse: false, id: null as string | null } },
    { opacity: opacity6, translateY: translateY6, metadata: { inUse: false, id: null as string | null } },
    { opacity: opacity7, translateY: translateY7, metadata: { inUse: false, id: null as string | null } },
    { opacity: opacity8, translateY: translateY8, metadata: { inUse: false, id: null as string | null } },
    { opacity: opacity9, translateY: translateY9, metadata: { inUse: false, id: null as string | null } }
  ]).current;

  // Animation refs for pending slide-in (for backwards compatibility)
  const pendingAnimsRef = React.useRef(
    new Map<
      string,
      {
        opacity: ReturnType<typeof useSharedValue<number>>;
        translateY: ReturnType<typeof useSharedValue<number>>;
      }
    >()
  );

  // Get or allocate animation from pool
  const getAnimation = React.useCallback((id: string) => {
    // Check if already in use
    const existing = animationPool.find((a) => a.metadata.id === id);
    if (existing) {
      return { opacity: existing.opacity, translateY: existing.translateY };
    }

    // Find unused slot
    const unused = animationPool.find((a) => !a.metadata.inUse);
    if (unused) {
      unused.metadata.inUse = true;
      unused.metadata.id = id;
      unused.opacity.value = 0;
      unused.translateY.value = 12;
      return { opacity: unused.opacity, translateY: unused.translateY };
    }

    // Fallback: reuse oldest slot
    const oldest = animationPool[0]!;
    oldest.metadata.id = id;
    oldest.opacity.value = 0;
    oldest.translateY.value = 12;
    return { opacity: oldest.opacity, translateY: oldest.translateY };
  }, []); // Empty deps since animationPool is from .current (stable)

  // Release animation back to pool
  const releaseAnimation = React.useCallback((id: string) => {
    const anim = animationPool.find((a) => a.metadata.id === id);
    if (anim) {
      anim.metadata.inUse = false;
      anim.metadata.id = null;
    }
  }, []); // Empty deps since animationPool is from .current (stable)

  const startRecording = React.useCallback(
    (insertionIndex: number) => {
      setIsRecording(true);

      const tempId = uuid.v4() + '_temp';

      // The pending card appears at the insertion boundary
      // When saved, it will become a real item with order_index = insertionIndex
      setPendingSegments((prev) => [
        ...prev,
        {
          tempId,
          name: 'Recording...',
          status: 'recording' as const,
          placementIndex: insertionIndex, // Shows at this visual position
          createdAt: Date.now()
        }
      ]);

      // ✅ GOOD: Get pre-created animation from pool
      const anims = getAnimation(tempId);
      pendingAnimsRef.current.set(tempId, anims);

      anims.opacity.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic)
      });
      anims.translateY.value = withTiming(0, {
        duration: 220,
        easing: Easing.out(Easing.cubic)
      });

      return tempId;
    },
    [getAnimation]
  );

  const createPendingCard = React.useCallback(
    (insertionIndex: number, name = 'Recording...') => {
      // Create pending card WITHOUT setting isRecording=true (for VAD mode)
      const tempId = uuid.v4() + '_temp';

      setPendingSegments((prev) => [
        ...prev,
        {
          tempId,
          name,
          status: 'recording' as const,
          placementIndex: insertionIndex,
          createdAt: Date.now()
        }
      ]);

      // ✅ GOOD: Get pre-created animation from pool
      const anims = getAnimation(tempId);
      pendingAnimsRef.current.set(tempId, anims);

      anims.opacity.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic)
      });
      anims.translateY.value = withTiming(0, {
        duration: 220,
        easing: Easing.out(Easing.cubic)
      });

      return tempId;
    },
    [getAnimation]
  );

  const stopRecording = React.useCallback(() => {
    setIsRecording(false);

    // Freeze most recent recording card into saving state
    setPendingSegments((prev) => {
      const next = [...prev];
      const idx = next.findIndex((p) => p.status === 'recording');
      if (idx !== -1) {
        const existing = next[idx];
        if (!existing) return next;
        next[idx] = { ...existing, status: 'saving' };
      }
      return next;
    });
  }, []);

  const removePending = React.useCallback(
    (tempId?: string | null) => {
      // Release animation back to pool
      if (tempId) {
        releaseAnimation(tempId);
      }

      setPendingSegments((prev) =>
        prev.filter((p) => {
          if (tempId) return p.tempId !== tempId;
          // If no tempId provided, remove all recording/saving cards
          return p.status !== 'recording' && p.status !== 'saving';
        })
      );
    },
    [releaseAnimation]
  );

  // Cleanup animations for removed pending IDs
  React.useEffect(() => {
    const ids = new Set(pendingSegments.map((p) => p.tempId));
    for (const key of Array.from(pendingAnimsRef.current.keys())) {
      if (!ids.has(key)) pendingAnimsRef.current.delete(key);
    }
  }, [pendingSegments]);

  return {
    isRecording,
    pendingSegments,
    pendingAnimsRef,
    startRecording,
    createPendingCard,
    stopRecording,
    removePending
  };
}
