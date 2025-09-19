const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// DO NOT ADD MJS TO ASSET EXTS - IT BREAKS THE ENTIRE APP
// config.resolver.assetExts.push('mjs');

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// Needed to make `@powersync/web/umd` imports work
config.resolver.unstable_enablePackageExports = true;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (
      [
        '@powersync/react-native',
        '@op-engineering/op-sqlite',
        '@powersync/op-sqlite'
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
