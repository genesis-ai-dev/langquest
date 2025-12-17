import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  resetEnergy: () => void;
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

  // Ref to track active state to avoid stale closures
  const isActiveRef = useRef(false);

  // Setup event listeners
  useEffect(() => {
    const energySubscription = MicrophoneEnergyModule.addListener(
      'onEnergyResult',
      (result: VADResult) => {
        // Only update if still active (handles rapid stop scenarios)
        if (isActiveRef.current) {
          // Update SharedValue only (for UI - no re-render!)
          // REMOVED: setState for energyResult - was causing 60fps re-renders
          // Components should use energyShared instead of energyResult
          energyShared.value = result.energy;
        }
      }
    );

    const errorSubscription = MicrophoneEnergyModule.addListener(
      'onError',
      (error: { message: string; code?: number; domain?: string }) => {
        console.error('❌ [JS] Microphone energy error received from native:');
        console.error('   Message:', error.message);
        if (error.code !== undefined) {
          console.error(
            `   Code: ${error.code}, Domain: ${error.domain ?? 'unknown'}`
          );
        }
        console.error('   Full error object:', error);
        setState((prev) => ({ ...prev, error: error.message }));
      }
    );

    return () => {
      energySubscription.remove();
      errorSubscription.remove();
    };
  }, [energyShared]);

  // Keep ref in sync with state
  useEffect(() => {
    isActiveRef.current = state.isActive;
  }, [state.isActive]);

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
    // Prevent starting if already active (handles rapid start/stop scenarios)
    if (isActiveRef.current) {
      console.log('⚠️ Energy detection already active, skipping start');
      return;
    }

    try {
      // Check permissions first using expo-av
      const permission = await Audio.getPermissionsAsync();
      if (!permission.granted) {
        const granted = await requestPermissions();
        if (!granted) throw new Error('Microphone permissions required');
      }

      await MicrophoneEnergyModule.startEnergyDetection();
      isActiveRef.current = true;
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
      // Reset energy SharedValue to 0 to prevent stuck values
      energyShared.value = 0;
      isActiveRef.current = false;
      setState((prev) => ({ ...prev, isActive: false, energyResult: null }));
    } catch (error) {
      // Still reset energy value even on error
      energyShared.value = 0;
      isActiveRef.current = false;
      setState((prev) => ({
        ...prev,
        error: `Stop energy detection error: ${error as string}`
      }));
      throw error;
    }
  }, [energyShared]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const resetEnergy = useCallback(() => {
    energyShared.value = 0;
  }, [energyShared]);

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
    resetEnergy,
    startSegment,
    stopSegment,
    energyShared
  };
}
