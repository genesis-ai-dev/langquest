import { Asset } from 'expo-asset';

export const loadAsset = async (assetId: string) => {
  const asset = await Asset.fromModule(assetId);
  return asset;
};
