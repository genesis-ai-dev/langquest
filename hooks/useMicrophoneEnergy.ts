import { Audio } from 'expo-av';
import { useCallback, useEffect, useState } from 'react';
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
}

export function useMicrophoneEnergy(): UseMicrophoneEnergy {
  const [state, setState] = useState<UseMicrophoneEnergyState>({
    isActive: false,
    energyResult: null,
    error: null
  });

  // Setup event listeners
  useEffect(() => {
    const energySubscription = MicrophoneEnergyModule.addListener(
      'onEnergyResult',
      (result: VADResult) => {
        console.log('onEnergyResult', result);
        setState((prev) => ({ ...prev, energyResult: result }));
      }
    );

    const errorSubscription = MicrophoneEnergyModule.addListener(
      'onError',
      (error: { message: string }) => {
        console.log('onError', error);
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

  return {
    ...state,
    requestPermissions,
    startEnergyDetection,
    stopEnergyDetection,
    clearError
  };
}
