/**
 * useRecordingState - Manages recording lifecycle and pending segments
 * 
 * Handles:
 * - Recording start/stop state
 * - Pending segment tracking
 * - Optimistic pending cards with animations
 */

import React from 'react';
import { Animated, Easing } from 'react-native';
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
        Map<string, { opacity: Animated.Value; translateY: Animated.Value }>
    >;
    startRecording: (insertionIndex: number) => string;
    stopRecording: () => void;
    removePending: (tempId: string) => void;
}

export function useRecordingState(): UseRecordingStateReturn {
    const [isRecording, setIsRecording] = React.useState(false);
    const [pendingSegments, setPendingSegments] = React.useState<PendingSegment[]>([]);

    // Animation refs for pending slide-in
    const pendingAnimsRef = React.useRef(
        new Map<string, { opacity: Animated.Value; translateY: Animated.Value }>()
    );

    const startRecording = React.useCallback((insertionIndex: number) => {
        setIsRecording(true);

        const tempId = uuid.v4() + '_temp';
        const targetOrder = insertionIndex + 1;

        // Insert pending segment
        setPendingSegments((prev) => [
            ...prev,
            {
                tempId,
                name: `Segment ${targetOrder}`,
                status: 'recording' as const,
                placementIndex: targetOrder,
                createdAt: Date.now()
            }
        ]);

        // Slide-in animation for the new pending card
        try {
            if (!pendingAnimsRef.current.has(tempId)) {
                const anims = {
                    opacity: new Animated.Value(0),
                    translateY: new Animated.Value(12)
                };
                pendingAnimsRef.current.set(tempId, anims);
                Animated.parallel([
                    Animated.timing(anims.opacity, {
                        toValue: 1,
                        duration: 220,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: true
                    }),
                    Animated.timing(anims.translateY, {
                        toValue: 0,
                        duration: 220,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: true
                    })
                ]).start();
            }
        } catch {
            // Animation setup failed, continue without animation
        }

        return tempId;
    }, []);

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

    const removePending = React.useCallback((tempId?: string) => {
        setPendingSegments((prev) =>
            prev.filter((p) => {
                if (tempId) return p.tempId !== tempId;
                return p.status !== 'recording' && p.status !== 'saving';
            })
        );
    }, []);

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
        stopRecording,
        removePending
    };
}

