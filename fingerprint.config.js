const assert = require('node:assert');

/**
 * Determines if we're generating an Android fingerprint.
 * EAS generates fingerprints per platform, and we need to detect which platform
 * is being fingerprinted to conditionally exclude platform-specific sections.
 */
function isAndroidFingerprint() {
  // Check various environment variables that EAS might set
  const platform =
    process.env.EXPO_PLATFORM ||
    process.env.PLATFORM ||
    process.env.EAS_BUILD_PLATFORM;

  return platform === 'android';
}

/**
 * Determines if we're generating an iOS fingerprint.
 */
function isIosFingerprint() {
  // Check various environment variables that EAS might set
  const platform =
    process.env.EXPO_PLATFORM ||
    process.env.PLATFORM ||
    process.env.EAS_BUILD_PLATFORM;

  return platform === 'ios';
}

/**
 * Recursively removes any keys containing "ios" (case-insensitive) from an object.
 * Handles nested objects and arrays.
 */
function removeIosKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeIosKeys(item));
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip keys that contain "ios" (case-insensitive)
    if (key.toLowerCase().includes('ios')) {
      continue;
    }
    // Recursively clean nested objects and arrays
    cleaned[key] = removeIosKeys(value);
  }

  return cleaned;
}

/**
 * Recursively removes any keys containing "android" (case-insensitive) from an object.
 * Handles nested objects and arrays.
 */
function removeAndroidKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeAndroidKeys(item));
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip keys that contain "android" (case-insensitive)
    if (key.toLowerCase().includes('android')) {
      continue;
    }
    // Recursively clean nested objects and arrays
    cleaned[key] = removeAndroidKeys(value);
  }

  return cleaned;
}

/** @type {import('@expo/fingerprint').Config} */
const config = {
  fileHookTransform: (source, chunk, isEndOfFile, encoding) => {
    // Only process the expoConfig contents source
    if (source.type === 'contents' && source.id === 'expoConfig') {
      assert(isEndOfFile, 'contents source is expected to have single chunk.');

      // Parse the config
      const appConfig = JSON.parse(chunk);

      // Remove platform-specific sections when generating fingerprints
      // This ensures platform-specific config changes don't affect other platform fingerprints
      if (isAndroidFingerprint()) {
        // Recursively remove any keys containing "ios" from the entire config
        const androidConfig = removeIosKeys(appConfig);

        // Return normalized config without any iOS-related keys
        return JSON.stringify(androidConfig, null, 2);
      }

      if (isIosFingerprint()) {
        // Recursively remove any keys containing "android" from the entire config
        const iosConfig = removeAndroidKeys(appConfig);

        // Return normalized config without any Android-related keys
        return JSON.stringify(iosConfig, null, 2);
      }

      // For unknown platform, return config as-is
      return chunk;
    }

    // For other sources, return chunk unchanged
    return chunk;
  }
};

module.exports = config;
