const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// SQL Extension
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

config.resolver.sourceExts.push('sql');

module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16
});
