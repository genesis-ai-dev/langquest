import type { ImageSourcePropType } from 'react-native';

// Static require map for the selectable icon previews. Metro needs literal
// require() calls, so every slug is listed explicitly. Keys match the folder
// slugs and the manifest ids in profiles.data.ts.
export const ICON_PREVIEWS: Record<string, ImageSourcePropType> = {
  a01: require('@/assets/appearance/a01/icon.png'),
  a02: require('@/assets/appearance/a02/icon.png'),
  a03: require('@/assets/appearance/a03/icon.png'),
  a04: require('@/assets/appearance/a04/icon.png'),
  a05: require('@/assets/appearance/a05/icon.png'),
  b01: require('@/assets/appearance/b01/icon.png'),
  b02: require('@/assets/appearance/b02/icon.png'),
  b03: require('@/assets/appearance/b03/icon.png'),
  b04: require('@/assets/appearance/b04/icon.png'),
  b05: require('@/assets/appearance/b05/icon.png')
};
