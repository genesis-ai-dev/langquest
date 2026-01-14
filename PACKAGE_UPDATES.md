# Package Updates

This document explains why certain packages were updated in this PR.

## PostHog Packages

### posthog-react-native-session-replay
- **Previous**: `^1.1.1`
- **Updated**: `^1.2.3`
- **Reason**: Updated to latest version for bug fixes and improvements to session replay functionality

### posthog-js
- **Previous**: `^1.265.1`
- **Updated**: `^1.321.2`
- **Reason**: Updated to latest version for compatibility and latest features

### posthog-react-native
- **Previous**: `^4.3.0`
- **Updated**: `^4.18.0`
- **Reason**: Updated to latest version for bug fixes and improved React Native integration

## React Native Reanimated

### react-native-reanimated
- **Previous**: `~4.1.0`
- **Updated**: `~4.2.1`
- **Reason**: Updated to latest version for performance improvements, bug fixes, and new animation features

### react-native-worklets
- **Previous**: `0.5.1`
- **Updated**: `0.7.1`
- **Reason**: Updated as required peer dependency for `react-native-reanimated@4.2.1` (requires `>=0.7.0`)

## Summary

These updates ensure we're using the latest stable versions with bug fixes, performance improvements, and new features. The `react-native-worklets` update was necessary to satisfy the peer dependency requirement of the updated `react-native-reanimated` package.
