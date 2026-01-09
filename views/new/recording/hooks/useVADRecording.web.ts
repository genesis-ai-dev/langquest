/**
 * useVADRecording - Web Implementation
 *
 * WEB VAD STRATEGY:
 * 1. AudioContext for energy monitoring (real-time)
 * 2. MediaRecorder for capturing audio segments
 * 3. Ring buffer for preroll (captures speech onset without clipping)
 * 4. Schmitt trigger for robust onset/silence detection
 * 5. Callbacks match native interface: onSegmentStart, onSegmentComplete
 *
 * This provides the same deterministic behavior as the native implementation
 * but uses browser APIs instead of native modules.
 */

import { useMicrophoneEnergy } from '@/hooks/useMicrophoneEnergy';
import { VAD_SILENCE_DURATION_MIN } from '@/store/localStore';
import React from 'react';

interface UseVADRecordingProps {
  threshold: number;
  silenceDuration: number;
  isVADActive: boolean;
  onSegmentStart: () => void;
  onSegmentComplete: (uri: string) => void;
  isManualRecording: boolean;
}

interface UseVADRecordingReturn {
  currentEnergy: number;
  isRecording: boolean;
}

interface VADConfig {
  threshold: number;
  silenceDuration: number;
  onsetMultiplier: number;
  confirmMultiplier: number;
  minSegmentDuration: number;
}

// Ring buffer for preroll (captures audio before speech onset detected)
class RingBuffer {
  private chunks: Blob[] = [];
  private maxChunks: number;

  constructor(durationMs = 500, chunkMs = 100) {
    this.maxChunks = Math.ceil(durationMs / chunkMs);
  }

  add(chunk: Blob) {
    this.chunks.push(chunk);
    if (this.chunks.length > this.maxChunks) {
      this.chunks.shift();
    }
  }

  dump(): Blob[] {
    return [...this.chunks];
  }

  clear() {
    this.chunks = [];
  }
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

  React.useEffect(() => {
    onSegmentStartRef.current = onSegmentStart;
    onSegmentCompleteRef.current = onSegmentComplete;
  }, [onSegmentStart, onSegmentComplete]);

  // VAD state
  const vadConfigRef = React.useRef<VADConfig>({
    threshold,
    silenceDuration,
    onsetMultiplier: 0.25,
    confirmMultiplier: 0.5,
    minSegmentDuration: VAD_SILENCE_DURATION_MIN // Use minimum silence duration instead of hardcoded 500ms
  });

  // Update config when props change
  React.useEffect(() => {
    vadConfigRef.current = {
      threshold,
      silenceDuration,
      onsetMultiplier: 0.25,
      confirmMultiplier: 0.5,
      minSegmentDuration: VAD_SILENCE_DURATION_MIN // Use minimum silence duration instead of hardcoded 500ms
    };
  }, [threshold, silenceDuration]);

  // Recording state
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const recordingStreamRef = React.useRef<MediaStream | null>(null);
  const ringBufferRef = React.useRef<RingBuffer>(new RingBuffer(500, 100));
  const segmentChunksRef = React.useRef<Blob[]>([]);
  const segmentStartTimeRef = React.useRef<number>(0);

  // VAD state machine
  const vadStateRef = React.useRef<'idle' | 'onset' | 'speaking' | 'silence'>(
    'idle'
  );
  const silenceStartRef = React.useRef<number>(0);
  const lastEnergyRef = React.useRef<number>(0);

  const currentEnergy = energyResult?.energy ?? 0;

  // Cleanup function
  const cleanup = React.useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }

    segmentChunksRef.current = [];
    ringBufferRef.current.clear();
    vadStateRef.current = 'idle';
    setIsRecording(false);
  }, []);

  // Start a recording segment
  const startSegment = React.useCallback(async () => {
    try {
      console.log('🎬 Web VAD: Starting segment');

      // Get fresh media stream for recording
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }
      });
      recordingStreamRef.current = stream;

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });
      recorderRef.current = recorder;

      // Dump ring buffer to segment (preroll - captures speech onset)
      const preroll = ringBufferRef.current.dump();
      segmentChunksRef.current = [...preroll];
      ringBufferRef.current.clear();

      // Collect chunks during recording
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          segmentChunksRef.current.push(event.data);

          // Also add to ring buffer (for next segment's preroll)
          if (vadStateRef.current === 'idle') {
            ringBufferRef.current.add(event.data);
          }
        }
      };

      // Start recording with small time slices for responsive ring buffer
      recorder.start(100); // 100ms chunks
      segmentStartTimeRef.current = Date.now();
      setIsRecording(true);

      // Notify parent
      onSegmentStartRef.current();

      console.log('✅ Web VAD: Segment recording started');
    } catch (error) {
      console.error('❌ Failed to start segment:', error);
      cleanup();
    }
  }, [cleanup]);

  // Stop a recording segment
  const stopSegment = React.useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      console.warn('⚠️ No active recorder to stop');
      return;
    }

    try {
      console.log('🛑 Web VAD: Stopping segment');

      // Wait for recorder to stop and collect final chunks
      await new Promise<void>((resolve) => {
        recorder.onstop = () => {
          const duration = Date.now() - segmentStartTimeRef.current;
          const config = vadConfigRef.current;

          // Only save if meets minimum duration
          if (duration >= config.minSegmentDuration) {
            // Create blob from collected chunks
            const blob = new Blob(segmentChunksRef.current, {
              type: recorder.mimeType
            });

            // Create object URL (acts as URI)
            const uri = URL.createObjectURL(blob);

            console.log(
              `📼 Web VAD: Segment complete (${duration}ms, ${blob.size} bytes)`
            );

            // Notify parent
            onSegmentCompleteRef.current(uri);
          } else {
            console.log(
              `⏭️ Web VAD: Segment too short (${duration}ms), discarding but cleaning up`
            );
            // Still notify parent with empty URI to trigger cleanup
            onSegmentCompleteRef.current('');
          }

          resolve();
        };

        recorder.stop();
      });

      // Cleanup
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      }

      recorderRef.current = null;
      segmentChunksRef.current = [];
      setIsRecording(false);

      console.log('✅ Web VAD: Segment stopped and saved');
    } catch (error) {
      console.error('❌ Failed to stop segment:', error);
      cleanup();
    }
  }, [cleanup]);

  // VAD state machine (Schmitt trigger)
  React.useEffect(() => {
    if (!isActive || !energyResult) return;

    const energy = energyResult.energy;
    const config = vadConfigRef.current;
    const state = vadStateRef.current;

    // Calculate thresholds
    const onsetThreshold = config.threshold * config.onsetMultiplier;
    const confirmThreshold = config.threshold * config.confirmMultiplier;

    // State machine
    switch (state) {
      case 'idle':
        // Waiting for speech onset
        if (energy > onsetThreshold) {
          console.log('🔊 Web VAD: Onset detected');
          vadStateRef.current = 'onset';
        }
        break;

      case 'onset':
        // Confirming speech (prevent false positives)
        if (energy > confirmThreshold) {
          console.log('✅ Web VAD: Speech confirmed, starting segment');
          vadStateRef.current = 'speaking';
          void startSegment();
        } else if (energy < onsetThreshold) {
          // False alarm, back to idle
          console.log('❌ Web VAD: False onset, back to idle');
          vadStateRef.current = 'idle';
        }
        break;

      case 'speaking':
        // Speaking detected, monitoring for silence
        if (energy < confirmThreshold) {
          // Dropped below threshold, start silence timer
          if (silenceStartRef.current === 0) {
            silenceStartRef.current = Date.now();
            console.log('🤫 Web VAD: Silence started');
          }
          vadStateRef.current = 'silence';
        } else {
          // Still speaking, reset silence timer
          silenceStartRef.current = 0;
        }
        break;

      case 'silence':
        // Monitoring silence duration
        if (energy > confirmThreshold) {
          // Speech resumed
          console.log('🔊 Web VAD: Speech resumed');
          vadStateRef.current = 'speaking';
          silenceStartRef.current = 0;
        } else {
          // Check if silence duration exceeded
          const silenceDuration = Date.now() - silenceStartRef.current;
          if (silenceDuration >= config.silenceDuration) {
            console.log(
              '🛑 Web VAD: Silence threshold reached, stopping segment'
            );
            vadStateRef.current = 'idle';
            silenceStartRef.current = 0;
            void stopSegment();
          }
        }
        break;
    }

    lastEnergyRef.current = energy;
  }, [energyResult, isActive, startSegment, stopSegment]);

  // Start/stop energy detection when VAD is activated/deactivated
  React.useEffect(() => {
    if (isVADActive && !isActive && !isManualRecording) {
      console.log('🎯 Web VAD: Mode activated');
      void startEnergyDetection();
    } else if (!isVADActive && isActive) {
      console.log('🎯 Web VAD: Mode deactivated');

      // Stop any active recording
      if (isRecording) {
        void stopSegment();
      }

      void stopEnergyDetection();
      vadStateRef.current = 'idle';
      silenceStartRef.current = 0;
    }
  }, [
    isVADActive,
    isActive,
    isManualRecording,
    isRecording,
    startEnergyDetection,
    stopEnergyDetection,
    stopSegment
  ]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  return {
    currentEnergy,
    isRecording
  };
}
