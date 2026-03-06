import { NativeModule, requireNativeModule } from 'expo-modules-core';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type VADResult = {
  energy: number;
  timestamp: number;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type VADConfig = {
  threshold?: number;
  silenceDuration?: number;
  onsetMultiplier?: number;
  confirmMultiplier?: number;
  minSegmentDuration?: number;
  maxOnsetDuration?: number;
  rewindHalfPause?: boolean;
  minActiveAudioDuration?: number;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type MicrophoneEnergyModuleEvents = {
  onEnergyResult: (result: VADResult) => void;
  onError: (error: { message: string }) => void;
  onSegmentStart: () => void;
  onSegmentComplete: (payload: {
    uri: string;
    startTime: number;
    endTime: number;
    duration: number;
  }) => void;
};

declare class MicrophoneEnergyModule extends NativeModule<MicrophoneEnergyModuleEvents> {
  startEnergyDetection(): Promise<void>;
  stopEnergyDetection(): Promise<void>;
  configureVAD(config: VADConfig): Promise<void>;
  enableVAD(): Promise<void>;
  disableVAD(): Promise<void>;
  startSegment(options?: { prerollMs?: number }): Promise<void>;
  stopSegment(): Promise<string | null>;
  extractWaveform(
    uri: string,
    barCount: number,
    normalize?: boolean
  ): Promise<number[]>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<MicrophoneEnergyModule>('MicrophoneEnergy');
