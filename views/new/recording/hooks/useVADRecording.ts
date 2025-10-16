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

interface UseVADRecordingProps {
  threshold: number;
  silenceDuration: number;
  isVADActive: boolean;
  onSegmentStart: () => void; // Create pending card
  onSegmentComplete: (uri: string) => void; // Save to database
  isManualRecording: boolean;
}

interface UseVADRecordingReturn {
  currentEnergy: number;
  isRecording: boolean;
}

export function useVADRecording({
  threshold,
  silenceDuration,
  isVADActive,
  onSegmentStart,
  onSegmentComplete,
  isManualRecording
}: UseVADRecordingProps): UseVADRecordingReturn {
  const { isActive, energyResult, startEnergyDetection, stopEnergyDetection } =
    useMicrophoneEnergy();

  const [isRecording, setIsRecording] = React.useState(false);

  // Stable refs for callbacks
  const onSegmentStartRef = React.useRef(onSegmentStart);
  const onSegmentCompleteRef = React.useRef(onSegmentComplete);

  // Track segment start time to detect stuck recordings
  const segmentStartTimeRef = React.useRef<number | null>(null);
  const segmentTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
        console.log('🎯 Energy monitoring activated for manual recording (waveform only)');
        void startEnergyDetection();
        // Don't enable VAD auto-recording during manual mode
      } else {
        console.log('🎯 VAD mode activated - native VAD takes over');
        void startEnergyDetection().then(() => {
          void MicrophoneEnergyModule.enableVAD();
        });
      }
    } else if (!isVADActive && isActive) {
      console.log('🎯 Energy monitoring deactivated');
      void MicrophoneEnergyModule.disableVAD();
      void stopEnergyDetection();
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
        setIsRecording(true);
        segmentStartTimeRef.current = Date.now();

        // Set a timeout to clean up if segment never completes (e.g., discarded for being too short)
        // Timeout is generously long (10 seconds) to avoid false positives
        if (segmentTimeoutRef.current) {
          clearTimeout(segmentTimeoutRef.current);
        }
        segmentTimeoutRef.current = setTimeout(() => {
          if (segmentStartTimeRef.current) {
            console.log('⚠️ Native VAD: Segment timeout - likely discarded, cleaning up');
            setIsRecording(false);
            segmentStartTimeRef.current = null;
            // Notify parent with empty URI to trigger cleanup
            onSegmentCompleteRef.current('');
          }
        }, 10000);

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
  }, []);

  return {
    currentEnergy,
    isRecording
  };
}
