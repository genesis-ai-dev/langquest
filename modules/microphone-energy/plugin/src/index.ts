import { ConfigPlugin, createRunOncePlugin } from '@expo/config-plugins';

const pkg = { name: 'microphone-energy', version: '1.0.0' };

const withMicrophoneEnergy: ConfigPlugin = (config) => {
  // The plugin doesn't need to do anything special for now
  // The expo-module.config.json will handle the native module registration
  return config;
};

export default createRunOncePlugin(withMicrophoneEnergy, pkg.name, pkg.version);
