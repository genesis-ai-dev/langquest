const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */

// Define __DEV__ for build scripts (Expo Updates build script context)
// In Node.js context, __DEV__ might not be defined, so we check NODE_ENV
if (typeof __DEV__ === 'undefined') {
  global.__DEV__ = process.env.NODE_ENV !== 'production';
}

const config = getDefaultConfig(__dirname);

// DO NOT PUSH MJS TO ASSET EXTS SEPERATELY - DUPLICATE EXTENSIONS BREAK THE ENTIRE APP
// config.resolver.assetExts.push('mjs');

// Configure SVG transformer
const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer')
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg', 'mjs', 'cjs'] // MJS IS ADDED HERE
};

// Needed to make `@powersync/web/umd` imports work
config.resolver.unstable_enablePackageExports = true;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (
      [
        '@powersync/react-native',
        '@op-engineering/op-sqlite',
        '@powersync/op-sqlite',
        'react-native-audio-concat'
      ].includes(moduleName)
    ) {
      return {
        type: 'empty'
      };
    }
    const mapping = {
      'react-native': 'react-native-web',
      '@powersync/web': '@powersync/web/umd'
    };
    if (mapping[moduleName]) {
      console.log('remapping', moduleName);
      return context.resolveRequest(context, mapping[moduleName], platform);
    }
  } else {
    if (['@powersync/web'].includes(moduleName)) {
      return {
        type: 'empty'
      };
    }
  }

  // Ensure you call the default resolver.
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16
});
