Analyze migration steps and verify migration status:

---

## PHASE 1: Initial Setup

0. **Prepare Test Database Environment**
   - **Ask the user**: "Which version do you want to test migrations from? (e.g., '1.0', '2.0')" 
   - Store the user's response as `@version` variable
   - Check for database files in `testing/client-migrations/` directory matching `{@version}.db`
   - If no matching database found, inform the user and ask if they want to create one or use a different version
   - **CRITICAL: Copy database BEFORE querying content** - Create a fresh test copy directly from `{@version}.db` to `{@version}-test-cases.db`:
     ```bash
     cp testing/client-migrations/{@version}.db testing/client-migrations/{@version}-test-cases.db
     ```
   - **CRITICAL: Consolidate source database** - Consolidate the source database into a single file (no WAL/SHM):
     ```bash
     ./testing/client-migrations/consolidate-db.sh testing/client-migrations/{@version}.db
     ```
   - Consolidate the test database copy into a single file (no WAL/SHM):
     ```bash
     ./testing/client-migrations/consolidate-db.sh testing/client-migrations/{@version}-test-cases.db
     ```

---

## PHASE 2: Migration Analysis (BEFORE inserting test data)

1. **Analyze Registered Migrations**
   - Read `db/migrations/index.ts` to identify registered migrations and verify that a migration exists starting from `@version`
   - List all migrations registered in `db/migrations/index.ts`
   - Show migration path: from version → to version → description
   - Identify which migrations would run starting from `@version` (the version specified by the user)
   - Note which migration was tested based on `@version` and the test database used

2. **Analyze Migration Path**
   - If current version < target version, show which migrations would execute
   - Display migration descriptions and expected steps
   - Check if migration path is complete (no gaps between versions)
   - Verify migrations are registered in correct order
   - **If path has gaps or issues, STOP and inform user before proceeding**

---

## PHASE 3: Test Data Preparation

3. **Insert Test Data for Migration Testing**
   - Insert test data directly into the test database file using SQLite commands that represents the pre-migration state (version `@version`). The test data should match what the migration expects to find:
   - **Read all migration files** in the path from `@version` to target version to understand what pre-migration data structures each migration expects
   - **Identify migration requirements** by analyzing:
     - **ALL fields that migrations will read** - Carefully read migration SQL queries to identify every `jsonExtractColumns()` call and `json_extract()` usage
     - Legacy fields that migrations will read from
     - New fields/tables that migrations will create
     - Fields that migrations will populate
     - Edge cases mentioned in migration comments (e.g., missing records, synced vs local data)
     - **Field dependencies**: Some migrations use `COALESCE()` or fallback logic, so test data should include these fields to properly test the migration logic
   - **Create comprehensive test data** that covers:
     - **Legacy field scenarios**: Records with legacy fields that migrations will transform
     - **Reference data**: Supporting records that migrations will use to create new records
     - **Missing data scenarios**: Records that reference data that may or may not exist (to test fallback logic)
     - **Field population scenarios**: Records where new fields should be populated (e.g., NULL fields that migrations will backfill)
     - **Multiple migration coverage**: Test data that exercises all migrations in the path (not just the first one)
   - **Test data structure**:
     - Use PowerSync raw table names (e.g., `ps_data_local__{table_name}`) and insert into the `data` column as JSON
     - **CRITICAL: Include ALL fields that migrations will read** - Read migration files carefully to identify every field that migrations extract from source records
     - **For version 0.0**: Do NOT include `_metadata` field (migration 0.0→1.0 will add it)
     - **For version 1.0+**: Include `_metadata` with `schema_version: "@version"` to match the source version
     - Include records that will be transformed by each migration in the path
     - Do NOT insert records/tables that migrations are expected to create (let migrations create them)
     - Do NOT include fields that migrations are expected to populate (leave them NULL or missing)
   - **Generate real UUIDs for test data** using `uuidgen` (macOS/Linux) or `uuid` command. Never use fake IDs like "test-record-id" as these don't match the actual data format used by the application.
   - **Insert test data** directly into the SQLite file using `sqlite3` command with generated UUIDs
   - **Coverage approach**: Create test cases that verify:
     - Each migration step executes correctly
     - Data transformations happen as expected
     - New records/tables are created when needed
     - Fields are populated correctly
     - Edge cases are handled properly
   - **CRITICAL CHECKLIST before inserting test data**:
     - [ ] Read ALL migration files in the path to identify every field they read
     - [ ] For records with COALESCE/fallback logic: Include primary AND fallback fields
     - [ ] For records with foreign keys: Include the legacy FK field migrations will transform
     - [ ] For records with conditional logic: Include the field migrations check for branching
     - [ ] Verify test data matches pre-migration state (no fields that migrations will create/populate)
     - [ ] Use real UUIDs for all ID fields
     - [ ] Ensure version 0.0 records have NO `_metadata` field (migration will add it)

4. **Consolidate Test Database After Test Data Insertion**
   - **CRITICAL**: After inserting test data, consolidate the test database again to ensure all changes are checkpointed and WAL/SHM files are removed:
     ```bash
     ./testing/client-migrations/consolidate-db.sh testing/client-migrations/{@version}-test-cases.db
     ```
   - This ensures the database is a clean single file before copying to the device
   - SQLite operations during test data insertion may create WAL/SHM files that need to be consolidated

---

## PHASE 4: Deploy and Run Migrations

5. **Deploy Database and Run Migrations**
   - Run the replacement script (auto-detects iOS/Android):
     ```bash
     ./testing/client-migrations/replace-device-db.sh testing/client-migrations/{@version}-test-cases.db
     ```
   - After the script completes, restart the app manually (auto-detects iOS/Android):
     ```bash
     ./testing/client-migrations/restart-device-app.sh restart
     ```
   - **CRITICAL: Wait for app initialization** - After restarting the app, wait 8 seconds for the app to fully initialize and potentially run migrations:
     ```bash
     sleep 8
     ```
   - **IMPORTANT**: After waiting for app initialization:
     - **Note**: Migrations run through the MigrationScreen UI component. The app may show a migration screen that needs to complete.
     - **Query database directly** using `sqlite3` on the simulator database path (from replace-device-db.sh output) to verify migration status
     - The database path will be shown in the replace-device-db.sh output (e.g., `/Users/.../Library/sqlite.db`)
     - **Alternative**: If MCP local-db tools are available, use those to query the database directly
     - The database will reflect the migrated state after migrations complete

---

## PHASE 5: Verification

6. **Check Current Schema Version**
   - Query the minimum schema version across all local tables to verify migrations completed
   - Use `json_extract()` to read `_metadata.schema_version` from the `data` column
   - **Verify migration completion**: All records should show the target version if migrations completed successfully
   - **Check for partial migrations**: If records show intermediate versions, migrations may still be running or failed partway
   - Query multiple local tables to check for version consistency across all tables
   - **Expected result**: All records should be at the target `APP_SCHEMA_VERSION` from `db/constants.ts`

7. **Check Migration Status**
   - **Verify migration-specific records were created**: Query tables that migrations are expected to create or populate
   - **Approach**: For each migration in the path, check:
     - **New records created**: Count records in tables that migrations should create
     - **Field population**: Count records with vs without required fields populated after migration
     - **Data transformations**: Verify legacy fields were transformed correctly
   - **Query pattern**: Use SQL queries to verify:
     - Records exist where they should (migrations created them)
     - Fields are populated where they should be (migrations populated them)
     - Relationships are correct (foreign keys point to existing records)
   - **Identify any tables or fields** that migrations were expected to modify but didn't

8. **Verify Migration Success**
   - **Run comprehensive verification queries** to confirm all migrations completed successfully:
     - **Schema version check**: Query all local tables to verify all records are at target version
     - **Migration-specific data verification**: For each migration, verify:
       - New records were created (if migration creates records)
       - Fields were populated (if migration populates fields)
       - Data transformations happened correctly (if migration transforms data)
     - **Field population check**: Query for NULL values in fields that should have been populated
     - **Relationship integrity**: Verify foreign key relationships are correct using LEFT JOIN checks
   - **Compare actual vs expected**: Compare query results against expected state from migration descriptions
   - **Test case verification**: Verify each test case created in step 3 has the expected post-migration state

9. **Check for Edge Cases**
   - **Identify data inconsistencies** that migrations should have resolved:
     - **Missing required fields**: Query for records where fields that migrations should populate are still NULL
     - **Invalid foreign key references**: Query for references that point to non-existent records (LEFT JOIN checks)
     - **Relationship integrity**: Verify relationships between tables are correct using SQL JOIN queries
     - **Edge case scenarios**: Check for scenarios mentioned in migration comments:
       - Missing reference records (migration should create minimal/placeholder records)
       - Inactive records (migration may or may not process these)
       - Synced vs local data (migration should handle both)
       - Multiple references to same data (migration should deduplicate)
   - **Look for data inconsistencies** that migrations should have resolved but didn't

---

## PHASE 6: Wrap-up

10. **Generate Brief Report**
    - **Provide a summary at the end of the chat** with the following information:
      - **Migration Path**: List all migrations that ran (from `@version` to target version) with their descriptions
      - **Migration Status**: Overall status (completed successfully, partial, failed, or pending)
      - **Schema Version**: Current schema version found in database vs target version
      - **Test Case Results**: Brief summary of test cases verified (pass/fail for key scenarios)
      - **Key Findings**: 
        - Records created/modified by migrations
        - Fields populated correctly
        - Any data inconsistencies found
      - **Issues/Warnings**: Any problems discovered during verification
      - **Recommendations**: Brief suggestions if issues were found
    - **Keep report concise** - Focus on key results and any issues, not exhaustive details

11. **Cleanup Test Database**
    - **CRITICAL: Delete test cases database** - After completing the migration analysis, delete the test cases database file:
      ```bash
      rm testing/client-migrations/{@version}-test-cases.db
      ```
    - This ensures the test database doesn't accumulate and clutter the testing/client-migrations directory

---

## IMPORTANT NOTES

- **Always ask the user for `@version` first** - the version they want to test migrations from (e.g., "1.0", "2.0")
- **CRITICAL: Copy database BEFORE querying** - Always create `{@version}-test-cases.db` copy from `{@version}.db` before running any queries or test cases
- **Analyze migrations BEFORE inserting test data** - Steps 1-2 must complete before Step 3 to ensure test data properly covers all migration scenarios
- **Database query approach**: After migrations run, query the database directly using `sqlite3` on the simulator database path (shown in replace-device-db.sh output). Alternatively, use MCP local-db tools if available.
- **Migration execution**: Migrations run through the MigrationScreen UI component. The app will detect migrations are needed and show the migration screen. Migrations execute automatically or can be manually triggered.
- **Wait for completion**: After restarting the app, wait for migrations to complete (check database schema version). Initial wait of 8 seconds may not be enough - migrations may take longer depending on data volume.
- **Query timing**: 
  - Query immediately after app restart to see pre-migration state
  - Query again after migrations complete to verify post-migration state
  - If schema version hasn't changed, migrations may still be running or need manual trigger
- **Database path**: The replace-device-db.sh script outputs the database path. Use this path for direct SQLite queries.
- **Query approach**: Use PowerSync raw table names (e.g., `ps_data_local__{table_name}`) and query JSON data column directly
- **Test data approach**: Create test data that covers all migration scenarios, not just the first migration. Consider the entire migration path from `@version` to target version.
- **CRITICAL: Use real UUIDs for test data** - Always generate actual UUIDs using `uuidgen` (macOS/Linux) or `uuid` command before creating test data. Store UUIDs in shell variables and use them consistently throughout test data insertion and verification queries.
- **Verification approach**: Verify each migration step individually, then verify the final state matches the target version
- Use `@version` consistently throughout the analysis to reference the test version
