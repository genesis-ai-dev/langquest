import { NativeModule, requireNativeModule } from 'expo';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type VADResult = {
  energy: number;
  timestamp: number;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type MicrophoneEnergyModuleEvents = {
  onEnergyResult: (result: VADResult) => void;
  onError: (error: { message: string }) => void;
};

declare class MicrophoneEnergyModule extends NativeModule<MicrophoneEnergyModuleEvents> {
  startEnergyDetection(): Promise<void>;
  stopEnergyDetection(): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<MicrophoneEnergyModule>('MicrophoneEnergy');
