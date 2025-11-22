const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */

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
  // Replace useDrizzleStudio with no-op version in production builds
  // This allows the hook to be called unconditionally in code while ensuring
  // it does nothing in production (since hooks can't be conditionally called)
  if (
    !__DEV__ &&
    (moduleName === '@/hooks/useDrizzleStudio' ||
      moduleName.includes('/hooks/useDrizzleStudio') ||
      (moduleName.includes('useDrizzleStudio') &&
        !moduleName.includes('useDrizzleStudio.noop')))
  ) {
    return context.resolveRequest(
      context,
      '@/hooks/useDrizzleStudio.noop',
      platform
    );
  }

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
