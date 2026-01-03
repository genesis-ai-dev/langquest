# Testing Database Migrations

This folder contains tools and test databases for testing schema migrations in LangQuest.

## How to Test Migrations

Simply run the migration analysis command:

```
/analyze-migration-steps for 1.0 to 2.0
```

This command will:
- Prepare the test database
- Replace it in the iOS Simulator
- Restart the app to trigger migrations
- Verify migration success
- Generate an analysis report in this folder

## Prerequisites

- iOS Simulator must be running
- App must be installed on the simulator
- A database file for the version you want to test (e.g., `1.0.db`)

## Files

- `{version}.db` - Source database files for specific schema versions
- `{version}-test-cases.db` - Test copies (created during testing, cleaned up automatically)
- `migration-analysis-*.md` - Generated analysis reports
- Scripts for database consolidation and simulator management

