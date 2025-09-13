module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind', reanimated: false }]],
    plugins: [
      '@babel/plugin-transform-async-generator-functions',
      'react-native-worklets/plugin'
    ]
  };
};
