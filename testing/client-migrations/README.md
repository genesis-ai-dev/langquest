# Testing Database Migrations

This folder contains tools and test databases for testing schema migrations in LangQuest.

## How to Test Migrations

Simply run the migration analysis command:

```
/analyze-migration-steps for 1.0 to 2.0
```

This command will:
- Prepare the test database
- Replace it in the iOS Simulator or Android Emulator (auto-detected)
- Restart the app to trigger migrations
- Verify migration success
- Generate an analysis report in this folder

## Prerequisites

- iOS Simulator **OR** Android Emulator must be running
- App must be installed on the simulator/emulator
- A database file for the version you want to test (e.g., `1.0.db`)
- For Android: Android SDK Platform Tools (`adb`) must be installed and in PATH

## Platform Detection

The scripts automatically detect which platform is running:
- **iOS**: Detects booted iOS Simulator using `xcrun simctl`
- **Android**: Detects connected Android Emulator/Device using `adb`

## Files

- `{version}.db` - Source database files for specific schema versions
- `{version}-test-cases.db` - Test copies (created during testing, cleaned up automatically)
- `migration-analysis-*.md` - Generated analysis reports
- `replace-device-db.sh` - Unified script for replacing database (iOS/Android)
- `restart-device-app.sh` - Unified script for restarting app (iOS/Android)
- `consolidate-db.sh` - Script for consolidating SQLite databases

