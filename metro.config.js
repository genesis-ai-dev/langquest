const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// SQL Extension
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

config.resolver.sourceExts.push('sql');

module.exports = config;
