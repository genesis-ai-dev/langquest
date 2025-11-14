/**
 * useVADRecording - Hook for Native Voice Activity Detection
 *
 * NATIVE VAD STRATEGY:
 * 1. Native module does EVERYTHING: onset detection, confirmation, silence monitoring, recording
 * 2. JavaScript just configures VAD settings and listens for events
 * 3. onSegmentStart event → Create pending card (UI only)
 * 4. onSegmentComplete event → Save URI to database
 * 5. Zero JS bridge latency for detection decisions
 */

import { useMicrophoneEnergy } from '@/hooks/useMicrophoneEnergy';
import MicrophoneEnergyModule from '@/modules/microphone-energy';
import React from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';

interface UseVADRecordingProps {
  threshold: number;
  silenceDuration: number;
  isVADActive: boolean;
  onSegmentStart: () => void; // Create pending card
  onSegmentComplete: (uri: string) => void; // Save to database
  isManualRecording: boolean;
}

interface UseVADRecordingReturn {
  currentEnergy: number; // Keep for backward compat
  isRecording: boolean; // Keep for React components
  energyShared: SharedValue<number>; // For UI performance
  isRecordingShared: SharedValue<boolean>; // NEW: For instant UI updates
}

export function useVADRecording({
  threshold,
  silenceDuration,
  isVADActive,
  onSegmentStart,
  onSegmentComplete,
  isManualRecording
}: UseVADRecordingProps): UseVADRecordingReturn {
  const {
    isActive,
    energyResult,
    startEnergyDetection,
    stopEnergyDetection,
    energyShared
  } = useMicrophoneEnergy();

  const [isRecording, setIsRecording] = React.useState(false);

  // NEW: SharedValue for INSTANT UI updates (bypasses React render cycle)
  // This updates synchronously when native VAD fires events - NO LAG!
  const isRecordingShared = useSharedValue(false);

  // Stable refs for callbacks
  const onSegmentStartRef = React.useRef(onSegmentStart);
  const onSegmentCompleteRef = React.useRef(onSegmentComplete);

  // Track segment start time to detect stuck recordings
  const segmentStartTimeRef = React.useRef<number | null>(null);
  const segmentTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  React.useEffect(() => {
    onSegmentStartRef.current = onSegmentStart;
    onSegmentCompleteRef.current = onSegmentComplete;
  }, [onSegmentStart, onSegmentComplete]);

  const currentEnergy = energyResult?.energy ?? 0;

  // Configure native VAD when settings change
  React.useEffect(() => {
    void MicrophoneEnergyModule.configureVAD({
      threshold,
      silenceDuration,
      onsetMultiplier: 0.25,
      confirmMultiplier: 0.5,
      minSegmentDuration: 500
    });
  }, [threshold, silenceDuration]);

  // Start energy detection and enable native VAD when active
  // Energy monitoring runs for both VAD and manual recording (for waveform)
  // VAD auto-recording only runs in VAD mode (not during manual)
  React.useEffect(() => {
    if (isVADActive && !isActive) {
      if (isManualRecording) {
        console.log(
          '🎯 Energy monitoring activated for manual recording (waveform only)'
        );
        void startEnergyDetection().catch((error) => {
          console.error(
            '❌ Failed to start energy detection for manual recording:',
            error
          );
        });
        // Don't enable VAD auto-recording during manual mode
      } else {
        console.log('🎯 VAD mode activated - native VAD takes over');
        void startEnergyDetection()
          .then(() => {
            console.log('✅ Energy detection started, enabling VAD...');
            void MicrophoneEnergyModule.enableVAD();
          })
          .catch((error) => {
            console.error(
              '❌ Failed to start energy detection for VAD mode:',
              error
            );
            // Error details should already be logged via onError event listener
            // But log here for visibility in this specific context
          });
      }
    } else if (!isVADActive && isActive) {
      console.log('🎯 Energy monitoring deactivated');
      void MicrophoneEnergyModule.disableVAD();
      void stopEnergyDetection().catch((error) => {
        console.error('❌ Failed to stop energy detection:', error);
      });
    }
  }, [
    isVADActive,
    isActive,
    isManualRecording,
    startEnergyDetection,
    stopEnergyDetection
  ]);

  React.useEffect(() => {
    // Listen for segment start events from native module
    const segmentStartSubscription = MicrophoneEnergyModule.addListener(
      'onSegmentStart', // Type will be available after native module rebuild
      () => {
        console.log('🎬 Native VAD: Segment starting');

        // CRITICAL: Update SharedValue FIRST for instant UI response (< 5ms)
        // This bypasses React's render cycle entirely!
        isRecordingShared.value = true;

        // Then update React state (for non-perf-critical components)
        setIsRecording(true);
        segmentStartTimeRef.current = Date.now();

        // Set a timeout to clean up if segment never completes (e.g., discarded for being too short)
        // Timeout is very long (60 seconds) to handle long recordings and avoid false positives
        // Real segments should complete within silence duration (typically 300-3000ms)
        if (segmentTimeoutRef.current) {
          clearTimeout(segmentTimeoutRef.current);
        }
        segmentTimeoutRef.current = setTimeout(() => {
          if (segmentStartTimeRef.current) {
            const elapsed = Date.now() - segmentStartTimeRef.current;
            console.log(
              `⚠️ Native VAD: Segment timeout after ${elapsed}ms - likely stuck, cleaning up`
            );
            isRecordingShared.value = false;
            setIsRecording(false);
            segmentStartTimeRef.current = null;
            // Notify parent with empty URI to trigger cleanup
            onSegmentCompleteRef.current('');
          }
        }, 60000); // 60 seconds - very generous for long recordings

        onSegmentStartRef.current();
      }
    );

    // Listen for segment complete events from native module
    const segmentCompleteSubscription = MicrophoneEnergyModule.addListener(
      'onSegmentComplete',
      (payload: { uri: string; duration: number }) => {
        console.log(
          '📼 Native VAD: Segment complete:',
          payload.uri,
          `(${payload.duration}ms)`
        );

        // CRITICAL: Update SharedValue FIRST for instant UI response
        isRecordingShared.value = false;

        // Clear timeout since we got a proper completion
        if (segmentTimeoutRef.current) {
          clearTimeout(segmentTimeoutRef.current);
          segmentTimeoutRef.current = null;
        }
        segmentStartTimeRef.current = null;

        setIsRecording(false);
        onSegmentCompleteRef.current(payload.uri);
      }
    );

    return () => {
      segmentStartSubscription.remove();
      segmentCompleteSubscription.remove();
      if (segmentTimeoutRef.current) {
        clearTimeout(segmentTimeoutRef.current);
      }
    };
  }, [isRecordingShared]);

  return {
    currentEnergy,
    isRecording,
    energyShared,
    isRecordingShared // NEW: For instant waveform updates
  };
}
