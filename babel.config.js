module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: 'nativewind',
          reanimated: false,
          unstable_transformImportMeta: true
        }
      ],
      'nativewind/babel'
    ],
    plugins: [
      '@babel/plugin-transform-async-generator-functions',
      '@babel/plugin-transform-export-namespace-from',
      'react-native-worklets/plugin'
    ]
  };
};
