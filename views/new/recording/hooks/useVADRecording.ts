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
import { VAD_SILENCE_DURATION_MIN, useLocalStore } from '@/store/localStore';
import React from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';

// ============================================================================
// MODULE-LEVEL LISTENER GENERATION COUNTER
// When React.lazy + Suspense causes the component to unmount and remount,
// old event listeners from the previous instance may not be properly cleaned up
// by the native module. This counter ensures that ONLY the latest hook instance's
// listeners process events. Stale listeners detect their generation is outdated
// and skip, allowing the current instance's listener to handle the event.
// ============================================================================
let listenerGeneration = 0;

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
  isDiscardedShared: SharedValue<number>; // NEW: Increments when a segment is discarded
}

export function useVADRecording({
  threshold,
  silenceDuration,
  isVADActive,
  onSegmentStart,
  onSegmentComplete,
  isManualRecording
}: UseVADRecordingProps): UseVADRecordingReturn {
  const micEnergy = useMicrophoneEnergy();
  // Extract with proper types to avoid TypeScript issues with .web.ts resolution
  const isActive = micEnergy.isActive;
  const startEnergyDetection = micEnergy.startEnergyDetection;
  const stopEnergyDetection = micEnergy.stopEnergyDetection;
  const energyShared = micEnergy.energyShared;
  // Create a typed reference to the energy ref
  const energyRef: { current: number } = micEnergy.energyRef;

  const [isRecording, setIsRecording] = React.useState(false);

  // NEW: SharedValue for INSTANT UI updates (bypasses React render cycle)
  // This updates synchronously when native VAD fires events - NO LAG!
  const isRecordingShared = useSharedValue(false);
  const isDiscardedShared = useSharedValue(0);

  // Stable refs for callbacks
  const onSegmentStartRef = React.useRef(onSegmentStart);
  const onSegmentCompleteRef = React.useRef(onSegmentComplete);
  const isVADActiveRef = React.useRef(isVADActive);
  const isManualRecordingRef = React.useRef(isManualRecording);

  // Track segment start time to detect stuck recordings
  const segmentStartTimeRef = React.useRef<number | null>(null);
  const segmentTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Track energy range during VAD recording
  const energyRangeRef = React.useRef<{ min: number; max: number } | null>(
    null
  );

  React.useEffect(() => {
    onSegmentStartRef.current = onSegmentStart;
    onSegmentCompleteRef.current = onSegmentComplete;
  }, [onSegmentStart, onSegmentComplete]);

  React.useEffect(() => {
    isVADActiveRef.current = isVADActive;
    isManualRecordingRef.current = isManualRecording;
  }, [isVADActive, isManualRecording]);

  // Use ref directly - no re-renders on energy changes!
  const currentEnergy = energyRef.current;

  // NOTE: Energy range tracking removed - was causing re-renders on every energy update.
  // The energyRangeRef is now updated via energyRef when segments start/end.

  // Track previous settings to detect actual changes (not just effect re-runs)
  const prevThresholdRef = React.useRef(threshold);
  const prevSilenceDurationRef = React.useRef(silenceDuration);

  // Get new VAD algorithm settings from store
  const vadOnsetMultiplier = useLocalStore((s) => s.vadOnsetMultiplier);
  const vadMaxOnsetDuration = useLocalStore((s) => s.vadMaxOnsetDuration);
  const vadRewindHalfPause = useLocalStore((s) => s.vadRewindHalfPause);
  const vadMinSegmentLength = useLocalStore((s) => s.vadMinSegmentLength);

  // Configure native VAD and manage activation/deactivation
  // NEW ALGORITHM: Uses threshold directly without Schmitt trigger scaling
  React.useEffect(() => {
    // Configure VAD whenever settings change (even if already active)
    const configureVAD = async () => {
      // NEW ALGORITHM: Pass threshold directly - no more multiplier scaling
      // The new native module uses raw peak amplitude with pre-onset buffer
      console.log(
        '🔧 Configuring VAD | threshold:',
        threshold.toFixed(4),
        '| onsetMultiplier:',
        vadOnsetMultiplier,
        '| maxOnsetDuration:',
        vadMaxOnsetDuration,
        '| rewindHalfPause:',
        vadRewindHalfPause,
        '| minSegmentLength:',
        vadMinSegmentLength
      );

      await MicrophoneEnergyModule.configureVAD({
        threshold, // Direct threshold - what you see is what you get
        silenceDuration,
        minSegmentDuration: VAD_SILENCE_DURATION_MIN,
        // New algorithm settings
        onsetMultiplier: vadOnsetMultiplier,
        maxOnsetDuration: vadMaxOnsetDuration,
        rewindHalfPause: vadRewindHalfPause,
        minActiveAudioDuration: vadMinSegmentLength
      });
    };

    // Detect if settings actually changed (not just effect re-run due to isActive change)
    const settingsChanged =
      prevThresholdRef.current !== threshold ||
      prevSilenceDurationRef.current !== silenceDuration;

    // Handle VAD activation/deactivation
    if (isVADActive && !isActive) {
      if (isManualRecording) {
        // Manual recording mode: only start energy detection for waveform visualization
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
        // VAD mode: configure first, then start detection, then enable VAD
        // This ensures configuration completes before VAD is enabled
        console.log('🎯 VAD mode activated - configuring and enabling...');
        void (async () => {
          try {
            // CRITICAL: Configure VAD BEFORE starting detection and enabling
            // This ensures the correct threshold is set before VAD begins monitoring
            await configureVAD();
            console.log('✅ VAD configured, starting energy detection...');

            await startEnergyDetection();
            console.log('✅ Energy detection started, enabling VAD...');

            await MicrophoneEnergyModule.enableVAD();
            // Log threshold values for debugging (new algorithm uses threshold directly)
            console.log(
              '✅ VAD enabled | threshold:',
              threshold.toFixed(4),
              '| onset:',
              (threshold * vadOnsetMultiplier).toFixed(4)
            );

            // Update refs after successful activation
            prevThresholdRef.current = threshold;
            prevSilenceDurationRef.current = silenceDuration;
          } catch (error) {
            console.error('❌ Failed to activate VAD mode:', error);
            // Error details should already be logged via onError event listener
            // But log here for visibility in this specific context
          }
        })();
      }
    } else if (!isVADActive && isActive) {
      // Deactivate VAD mode
      console.log('🎯 Energy monitoring deactivated');
      void MicrophoneEnergyModule.disableVAD();
      void stopEnergyDetection().catch((error) => {
        console.error('❌ Failed to stop energy detection:', error);
      });
    } else if (isVADActive && isActive && settingsChanged) {
      // VAD is already active and settings ACTUALLY changed - reconfigure on the fly
      // This allows users to adjust threshold/silence duration without restarting VAD
      console.log('🎯 VAD settings changed, reconfiguring...');
      void configureVAD()
        .then(() => {
          console.log('✅ VAD reconfigured with new settings');
          // Update refs after successful reconfiguration
          prevThresholdRef.current = threshold;
          prevSilenceDurationRef.current = silenceDuration;
        })
        .catch((error) => {
          console.error('❌ Failed to reconfigure VAD:', error);
        });
    }

    // Cleanup: ensure native energy detection is stopped on unmount
    // Without this, if VAD was active when the view unmounts, the native
    // AudioRecord would continue running in the background, consuming CPU/battery
    return () => {
      if (isActive) {
        console.log('🧹 useVADRecording cleanup: stopping energy detection');
        void MicrophoneEnergyModule.disableVAD();
        void stopEnergyDetection().catch((error) => {
          console.error(
            '❌ Failed to stop energy detection during cleanup:',
            error
          );
        });
      }
    };
  }, [
    isVADActive,
    isActive,
    isManualRecording,
    threshold,
    silenceDuration,
    vadOnsetMultiplier,
    vadMaxOnsetDuration,
    vadRewindHalfPause,
    vadMinSegmentLength,
    startEnergyDetection,
    stopEnergyDetection
  ]);

  React.useEffect(() => {
    // Increment generation counter. Only listeners matching the latest generation
    // will process events. Stale listeners from previous mount cycles will skip.
    listenerGeneration++;
    const myGeneration = listenerGeneration;

    // Listen for segment start events from native module
    const segmentStartSubscription = MicrophoneEnergyModule.addListener(
      'onSegmentStart', // Type will be available after native module rebuild
      () => {
        // Skip if this listener belongs to a stale hook instance
        if (myGeneration !== listenerGeneration) {
          console.log(
            `⚠️ Native VAD: Stale onSegmentStart listener (gen ${myGeneration} vs current ${listenerGeneration}), skipping`
          );
          return;
        }

        // Ignore native segment events that are not from active VAD mode.
        // Manual press/hold now also uses startSegment/stopSegment, and those
        // events must not flow through the VAD save pipeline.
        if (!isVADActiveRef.current || isManualRecordingRef.current) {
          return;
        }

        console.log('🎬 Native VAD: Segment starting');

        // CRITICAL: Update SharedValue FIRST for instant UI response (< 5ms)
        // This bypasses React's render cycle entirely!
        isRecordingShared.value = true;

        // Then update React state (for non-perf-critical components)
        setIsRecording(true);
        segmentStartTimeRef.current = Date.now();

        // Initialize energy range tracking for this segment
        const initialEnergy = energyRef.current;
        energyRangeRef.current = { min: initialEnergy, max: initialEnergy };

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
        // Skip if this listener belongs to a stale hook instance
        if (myGeneration !== listenerGeneration) {
          console.log(
            `⚠️ Native VAD: Stale onSegmentComplete listener (gen ${myGeneration} vs current ${listenerGeneration}), skipping`
          );
          return;
        }

        // Ignore native segment events that are not from active VAD mode.
        if (!isVADActiveRef.current || isManualRecordingRef.current) {
          return;
        }

        console.log(
          '📼 Native VAD: Segment complete:',
          payload.uri || 'DISCARDED',
          `(${payload.duration}ms)`
        );

        // If discarded, trigger retroactive UI update
        if (!payload.uri || payload.uri === '') {
          isDiscardedShared.value += 1;
        }

        // Log energy range for VAD recording
        if (energyRangeRef.current) {
          const range = energyRangeRef.current;
          console.log(
            `📊 VAD Recording Energy Range | min: ${range.min.toFixed(4)}, max: ${range.max.toFixed(4)}, range: ${(range.max - range.min).toFixed(4)}`
          );
          energyRangeRef.current = null;
        }

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
      // Belt-and-suspenders: removeAllListeners to clean up any leaked native
      // listeners from previous mount cycles. The Expo NativeModule EventEmitter
      // (C++ JSI) may not properly clean up listeners when subscription.remove()
      // is called during React.lazy + Suspense unmount/remount cycles.
      // Since useVADRecording is the sole consumer of these events, this is safe.
      MicrophoneEnergyModule.removeAllListeners('onSegmentStart');
      MicrophoneEnergyModule.removeAllListeners('onSegmentComplete');
      if (segmentTimeoutRef.current) {
        clearTimeout(segmentTimeoutRef.current);
      }
    };
  }, [isRecordingShared]);

  return {
    currentEnergy,
    isRecording,
    energyShared,
    isRecordingShared, // NEW: For instant waveform updates
    isDiscardedShared
  };
}
