import { Asset } from 'expo-asset';

// Asset mapping object
export const ASSET_MAP = {
  'asset_1': require('../sample_assets/images/asset_1.png'),
  'asset_2': require('../sample_assets/images/asset_2.png'),
  'asset_3': require('../sample_assets/images/asset_3.png'),
  'asset_4': require('../sample_assets/images/asset_4.png'),
  'asset_5': require('../sample_assets/images/asset_5.png'),
  'asset_6': require('../sample_assets/images/asset_6.png'),
  // Audio
  'audio_1': require('../sample_assets/audio/audio_1.mp3'),
  'audio_2': require('../sample_assets/audio/audio_2.mp3'),
  'audio_3': require('../sample_assets/audio/audio_3.mp3'),
  'audio_4': require('../sample_assets/audio/audio_4.mp3'),
  'audio_5': require('../sample_assets/audio/audio_5.mp3'),
} as const;

// Get asset module ID for storage
export const getAssetId = (assetKey: keyof typeof ASSET_MAP) => {
  return ASSET_MAP[assetKey];
};

// Load asset from module ID
export const loadAsset = async (moduleId: number) => {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  return asset;
};