const {
  withAndroidManifest,
  withGradleProperties,
  withDangerousMod
} = require('@expo/config-plugins');
const fs = require('fs/promises'); // Add this import

function modifyBuildGradle(contents) {
  // Replace minSdkVersion line
  contents = contents.replace(
    /minSdkVersion = Integer\.parseInt\(findProperty\('android\.minSdkVersion'\) \?: '\d+'\)/,
    "minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '24')"
  );

  // Add ffmpegKitPackage if not present
  if (!contents.includes('ffmpegKitPackage')) {
    contents = contents.replace(
      /ext {/,
      `ext {
        ffmpegKitPackage = "audio"`
    );
  }

  return contents;
}

const withAndroidConfig = (config) => {
  // Ensure minSdkVersion in manifest
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.$ || {};
    mainApplication['android:minSdkVersion'] = '24';
    return config;
  });

  // Modify build.gradle directly
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const buildGradlePath = 'android/build.gradle';
      const contents = await fs.readFile(buildGradlePath, 'utf-8');
      const newContents = modifyBuildGradle(contents);
      await fs.writeFile(buildGradlePath, newContents);
      return config;
    }
  ]);

  return config;
};

module.exports = withAndroidConfig;
