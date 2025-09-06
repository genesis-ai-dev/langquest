import { NativeModule, requireNativeModule } from 'expo-modules-core';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type VADResult = {
  energy: number;
  timestamp: number;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type MicrophoneEnergyModuleEvents = {
  onEnergyResult: (result: VADResult) => void;
  onError: (error: { message: string }) => void;
  onSegmentComplete: (payload: { uri: string; startTime: number; endTime: number; duration: number }) => void;
};

declare class MicrophoneEnergyModule extends NativeModule<MicrophoneEnergyModuleEvents> {
  startEnergyDetection(): Promise<void>;
  stopEnergyDetection(): Promise<void>;
  startSegment(options?: { prerollMs?: number }): Promise<void>;
  stopSegment(): Promise<string | null>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<MicrophoneEnergyModule>('MicrophoneEnergy');
