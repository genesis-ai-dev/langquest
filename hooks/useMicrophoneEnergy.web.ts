/**
 * useMicrophoneEnergy - Web Implementation
 *
 * Uses Web Audio API (AudioContext + AnalyserNode) for real-time energy monitoring
 * Provides the same interface as the native implementation
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface MicrophoneEnergyResult {
  energy: number; // Normalized energy level (0-1)
  smoothedEnergy?: number; // Exponential moving average
  timestamp: number;
}

export interface UseMicrophoneEnergyReturn {
  isActive: boolean;
  energyResult: MicrophoneEnergyResult | null;
  error: Error | null;
  startEnergyDetection: () => Promise<void>;
  stopEnergyDetection: () => Promise<void>;
  clearError: () => void;
  resetEnergy: () => void;
}

export function useMicrophoneEnergy(): UseMicrophoneEnergyReturn {
  const [isActive, setIsActive] = useState(false);
  const [energyResult, setEnergyResult] =
    useState<MicrophoneEnergyResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Audio context and stream refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const smoothedEnergyRef = useRef<number>(0);
  // Use ref to track active state to avoid stale closures in monitorEnergy
  const isActiveRef = useRef<boolean>(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up web audio context...');

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log('🛑 Stopped microphone track');
      });
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    smoothedEnergyRef.current = 0;
    isActiveRef.current = false;
    setIsActive(false);
    setEnergyResult(null);
  }, []);

  const startEnergyDetection = useCallback(async () => {
    // Prevent starting if already active (handles rapid start/stop scenarios)
    if (isActiveRef.current) {
      console.log('⚠️ Web energy detection already active, skipping start');
      return;
    }

    try {
      console.log('🎤 Starting web energy detection...');

      // Clean up any existing context first
      // This ensures we start fresh and prevents stuck states
      cleanup();

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false // AGC can interfere with energy measurements
        }
      });
      streamRef.current = stream;

      // Create audio context
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create analyser node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // Larger FFT for better frequency resolution
      analyser.smoothingTimeConstant = 0.8; // Built-in smoothing
      analyserRef.current = analyser;

      // Connect microphone to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      console.log(
        '✅ Web audio context created, sample rate:',
        audioContext.sampleRate
      );

      // Start monitoring energy levels
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const SMOOTHING_FACTOR = 0.3; // EMA smoothing (match native implementation)

      const monitorEnergy = () => {
        // Use ref to check active state to avoid stale closure issues
        // This handles rapid start/stop scenarios correctly
        if (!analyserRef.current || !isActiveRef.current) {
          // Clean up animation frame if we're stopping
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          return;
        }

        // Get frequency data (0-255 range)
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate RMS energy from frequency domain
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = dataArray[i]! / 255.0; // Normalize to 0-1
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / dataArray.length);

        // Apply exponential moving average for stability
        const currentSmoothed = smoothedEnergyRef.current;
        const newSmoothed =
          currentSmoothed * (1 - SMOOTHING_FACTOR) + rms * SMOOTHING_FACTOR;
        smoothedEnergyRef.current = newSmoothed;

        // Update state
        setEnergyResult({
          energy: rms,
          smoothedEnergy: newSmoothed,
          timestamp: Date.now()
        });

        // Continue monitoring
        animationFrameRef.current = requestAnimationFrame(monitorEnergy);
      };

      isActiveRef.current = true;
      setIsActive(true);
      setError(null);
      monitorEnergy();

      console.log('✅ Energy monitoring started');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('❌ Failed to start energy detection:', error);
      setError(error);
      cleanup();
    }
  }, [cleanup, isActive]);

  const stopEnergyDetection = useCallback(async () => {
    console.log('🛑 Stopping web energy detection...');
    // Reset energy result immediately before cleanup to prevent stuck values
    setEnergyResult(null);
    cleanup();
  }, [cleanup]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetEnergy = useCallback(() => {
    setEnergyResult(null);
    smoothedEnergyRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isActive,
    energyResult,
    error,
    startEnergyDetection,
    stopEnergyDetection,
    clearError,
    resetEnergy
  };
}
