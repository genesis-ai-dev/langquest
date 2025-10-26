import { Audio } from 'expo-av';
import { useCallback, useEffect, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import type { VADResult } from '../modules/microphone-energy';
import MicrophoneEnergyModule from '../modules/microphone-energy';

interface UseMicrophoneEnergyState {
  isActive: boolean;
  energyResult: VADResult | null;
  error: string | null;
}

interface UseMicrophoneEnergy extends UseMicrophoneEnergyState {
  requestPermissions: () => Promise<boolean>;
  startEnergyDetection: () => Promise<void>;
  stopEnergyDetection: () => Promise<void>;
  clearError: () => void;
  startSegment: (options?: { prerollMs?: number }) => Promise<void>;
  stopSegment: () => Promise<string | null>;
  // NEW: SharedValue for high-performance UI updates
  energyShared: SharedValue<number>;
}

export function useMicrophoneEnergy(): UseMicrophoneEnergy {
  const [state, setState] = useState<UseMicrophoneEnergyState>({
    isActive: false,
    energyResult: null,
    error: null
  });

  // NEW: SharedValue for high-performance UI updates (no re-renders!)
  const energyShared = useSharedValue(0);

  // Setup event listeners
  useEffect(() => {
    const energySubscription = MicrophoneEnergyModule.addListener(
      'onEnergyResult',
      (result: VADResult) => {
        // Update SharedValue first (for UI - no re-render)
        energyShared.value = result.energy;
        // Update state silently for logic that needs it
        setState((prev) => ({ ...prev, energyResult: result }));
      }
    );

    const errorSubscription = MicrophoneEnergyModule.addListener(
      'onError',
      (error: { message: string }) => {
        console.error('🎤 Microphone energy error:', error);
        setState((prev) => ({ ...prev, error: error.message }));
      }
    );

    return () => {
      energySubscription.remove();
      errorSubscription.remove();
    };
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      // Use expo-av for all permission handling
      const status = await Audio.requestPermissionsAsync();
      return status.granted;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Permission error: ${error as string}`
      }));
      return false;
    }
  }, []);

  const startEnergyDetection = useCallback(async (): Promise<void> => {
    try {
      // Check permissions first using expo-av
      const permission = await Audio.getPermissionsAsync();
      if (!permission.granted) {
        const granted = await requestPermissions();
        if (!granted) throw new Error('Microphone permissions required');
      }

      await MicrophoneEnergyModule.startEnergyDetection();
      setState((prev) => ({ ...prev, isActive: true, error: null }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Start energy detection error: ${error as string}`
      }));
      throw error;
    }
  }, [requestPermissions]);

  const stopEnergyDetection = useCallback(async (): Promise<void> => {
    try {
      await MicrophoneEnergyModule.stopEnergyDetection();
      setState((prev) => ({ ...prev, isActive: false, energyResult: null }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Stop energy detection error: ${error as string}`
      }));
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const startSegment = useCallback(async (options?: { prerollMs?: number }) => {
    try {
      await (
        MicrophoneEnergyModule as unknown as {
          startSegment: (opts?: { prerollMs?: number }) => Promise<void>;
        }
      ).startSegment(options);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Start segment error: ${String(error)}`
      }));
      throw error;
    }
  }, []);

  const stopSegment = useCallback(async (): Promise<string | null> => {
    try {
      const uri = await (
        MicrophoneEnergyModule as unknown as {
          stopSegment: () => Promise<string | null>;
        }
      ).stopSegment();
      return uri;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Stop segment error: ${String(error)}`
      }));
      throw error;
    }
  }, []);

  return {
    ...state,
    requestPermissions,
    startEnergyDetection,
    stopEnergyDetection,
    clearError,
    startSegment,
    stopSegment,
    energyShared
  };
}
