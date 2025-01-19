import { Asset } from 'expo-asset';

// Asset mapping object
export const ASSET_MAP = {
  // Images
  asset_1: require('../sample_assets/images/asset_1.png'),
  asset_2: require('../sample_assets/images/asset_2.png'),
  asset_3: require('../sample_assets/images/asset_3.png'),
  asset_4: require('../sample_assets/images/asset_4.png'),
  asset_5: require('../sample_assets/images/asset_5.png'),
  asset_6: require('../sample_assets/images/asset_6.png'),
  'moon.jpg': require('../sample_assets/images/moon.jpg'),
  'stars.jpg': require('../sample_assets/images/stars.jpg'),
  'sun.jpg': require('../sample_assets/images/sun.jpg'),

  // Audio
  audio_1: require('../sample_assets/audio/audio_1.mp3'),
  audio_2: require('../sample_assets/audio/audio_2.mp3'),
  audio_3: require('../sample_assets/audio/audio_3.mp3'),
  audio_4: require('../sample_assets/audio/audio_4.mp3'),
  audio_5: require('../sample_assets/audio/audio_5.mp3'),

  // LUK Audio Files
  'LUK_1_1_BES.mp3': require('../sample_assets/audio/LUK_1_1_BES.mp3'),
  'LUK_1_1_PDDPT.mp3': require('../sample_assets/audio/LUK_1_1_PDDPT.mp3'),
  'LUK_1_2_BES.mp3': require('../sample_assets/audio/LUK_1_2_BES.mp3'),
  'LUK_1_2_PDDPT.mp3': require('../sample_assets/audio/LUK_1_2_PDDPT.mp3'),
  'LUK_1_3_BES.mp3': require('../sample_assets/audio/LUK_1_3_BES.mp3'),
  'LUK_1_3_PDDPT.mp3': require('../sample_assets/audio/LUK_1_3_PDDPT.mp3'),
  'LUK_1_4_BES.mp3': require('../sample_assets/audio/LUK_1_4_BES.mp3'),
  'LUK_1_4_PDDPT.mp3': require('../sample_assets/audio/LUK_1_4_PDDPT.mp3'),
  'LUK_1_5_BES.mp3': require('../sample_assets/audio/LUK_1_5_BES.mp3'),
  'LUK_1_5_PDDPT.mp3': require('../sample_assets/audio/LUK_1_5_PDDPT.mp3'),
  'LUK_1_6_BES.mp3': require('../sample_assets/audio/LUK_1_6_BES.mp3'),
  'LUK_1_6_PDDPT.mp3': require('../sample_assets/audio/LUK_1_6_PDDPT.mp3'),
  'LUK_1_7_BES.mp3': require('../sample_assets/audio/LUK_1_7_BES.mp3'),
  'LUK_1_7_PDDPT.mp3': require('../sample_assets/audio/LUK_1_7_PDDPT.mp3'),
  'LUK_1_8_BES.mp3': require('../sample_assets/audio/LUK_1_8_BES.mp3'),
  'LUK_1_8_PDDPT.mp3': require('../sample_assets/audio/LUK_1_8_PDDPT.mp3'),
  'LUK_2_1_BES.mp3': require('../sample_assets/audio/LUK_2_1_BES.mp3'),
  'LUK_2_1_PDDPT.mp3': require('../sample_assets/audio/LUK_2_1_PDDPT.mp3'),
  'LUK_2_2_BES.mp3': require('../sample_assets/audio/LUK_2_2_BES.mp3'),
  'LUK_2_2_PDDPT.mp3': require('../sample_assets/audio/LUK_2_2_PDDPT.mp3'),
  'LUK_2_3_BES.mp3': require('../sample_assets/audio/LUK_2_3_BES.mp3'),
  'LUK_2_3_PDDPT.mp3': require('../sample_assets/audio/LUK_2_3_PDDPT.mp3'),
  'LUK_2_4_BES.mp3': require('../sample_assets/audio/LUK_2_4_BES.mp3'),
  'LUK_2_4_PDDPT.mp3': require('../sample_assets/audio/LUK_2_4_PDDPT.mp3'),
  'LUK_2_5_BES.mp3': require('../sample_assets/audio/LUK_2_5_BES.mp3'),
  'LUK_2_5_PDDPT.mp3': require('../sample_assets/audio/LUK_2_5_PDDPT.mp3'),
  'LUK_2_6_BES.mp3': require('../sample_assets/audio/LUK_2_6_BES.mp3'),
  'LUK_2_6_PDDPT.mp3': require('../sample_assets/audio/LUK_2_6_PDDPT.mp3'),
  'LUK_2_7_BES.mp3': require('../sample_assets/audio/LUK_2_7_BES.mp3'),
  'LUK_2_7_PDDPT.mp3': require('../sample_assets/audio/LUK_2_7_PDDPT.mp3'),
  'LUK_2_8_BES.mp3': require('../sample_assets/audio/LUK_2_8_BES.mp3'),
  'LUK_2_8_PDDPT.mp3': require('../sample_assets/audio/LUK_2_8_PDDPT.mp3')
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
