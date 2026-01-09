Analyze migration steps and verify migration status:

**PREPARATION: Setup Test Database and Run Migration**

0. **Prepare Test Database for Migration Testing**
   - **Ask the user**: "Which version do you want to test migrations from? (e.g., '1.0', '2.0')" 
   - Store the user's response as `@version` variable
   - Read `db/migrations/index.ts` to identify registered migrations and verify that a migration exists starting from `@version`
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
   - **Insert test data for migration testing** - Insert test data directly into the test database file using SQLite commands that represents the pre-migration state (version `@version`). The test data should match what the migration expects to find:
     - **Read all migration files** in the path from `@version` to target version to understand what pre-migration data structures each migration expects
     - **Identify migration requirements** by analyzing:
       - Legacy fields that migrations will read from (e.g., `target_language_id`, `source_language_id`)
       - New fields/tables that migrations will create (e.g., `project_language_link_local`, `languoid_local`)
       - Fields that migrations will populate (e.g., `languoid_id`, `versification_template`, `content_type`)
       - Edge cases mentioned in migration comments (e.g., missing records, synced vs local data)
     - **Create comprehensive test data** that covers:
       - **Legacy field scenarios**: Records with legacy fields that migrations will transform
       - **Reference data**: Supporting records (e.g., `language_local`, `language`) that migrations will use to create new records
       - **Missing data scenarios**: Records that reference data that may or may not exist (to test fallback logic)
       - **Field population scenarios**: Records where new fields should be populated (e.g., NULL fields that migrations will backfill)
       - **Multiple migration coverage**: Test data that exercises all migrations in the path (not just the first one)
     - **Test data structure**:
       - Use PowerSync raw table names (e.g., `ps_data_local__project_local`) and insert into the `data` column as JSON
       - Ensure all records have `_metadata` with `schema_version: "@version"` to match the source version
       - Include records that will be transformed by each migration in the path
       - Do NOT insert records/tables that migrations are expected to create (let migrations create them)
       - Do NOT include fields that migrations are expected to populate (leave them NULL or missing)
     - **Insert test data** directly into the SQLite file using `sqlite3` command:
       ```bash
       sqlite3 testing/client-migrations/{@version}-test-cases.db <<EOF
       -- Example: Insert records with legacy fields that migration will transform
       INSERT OR REPLACE INTO ps_data_local__project_local (id, data) VALUES (
         'test-project-id',
         json_object(
           'id', 'test-project-id',
           'target_language_id', 'test-language-id',  -- Legacy field migration will read
           'active', 1,
           '_metadata', json_object('schema_version', '@version')
         )
       );
       -- Add supporting records (e.g., languages) that migrations will reference
       -- Add records for each migration scenario in the path
       EOF
       ```
     - **Coverage approach**: Create test cases that verify:
       - Each migration step executes correctly
       - Data transformations happen as expected
       - New records/tables are created when needed
       - Fields are populated correctly
       - Edge cases are handled properly
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

1. **Check Current Schema Version**
   - Query the minimum schema version across all local tables to verify migrations completed:
     ```sql
     SELECT 
       json_extract(json(json_extract(data, '$._metadata')), '$.schema_version') as schema_version,
       COUNT(*) as count
     FROM ps_data_local__project_local
     WHERE json_extract(data, '$._metadata') IS NOT NULL
     GROUP BY schema_version
     ORDER BY schema_version
     ```
   - **Verify migration completion**: All records should show the target version (e.g., `2.2`) if migrations completed successfully
   - **Check for partial migrations**: If records show intermediate versions (e.g., `2.0`, `2.1`), migrations may still be running or failed partway
   - Query other local tables (`language_local`, `asset_local`, etc.) to check for version consistency across all tables
   - **Expected result**: All records should be at the target `APP_SCHEMA_VERSION` from `db/constants.ts`

2. **Analyze Registered Migrations**
   - List all migrations registered in `db/migrations/index.ts`
   - Show migration path: from version → to version → description
   - Identify which migrations would run starting from `@version` (the version specified by the user)
   - Note which migration was tested based on `@version` and the test database used

3. **Check Migration Status**
   - **Verify migration-specific records were created**: Query tables that migrations are expected to create or populate
   - **Approach**: For each migration in the path, check:
     - **New records created**: Count records in tables that migrations should create (e.g., `project_language_link_local`, `languoid_local`)
     - **Field population**: Count records with vs without required fields populated after migration
     - **Data transformations**: Verify legacy fields were transformed correctly (e.g., `target_language_id` → `project_language_link_local`)
   - **Query pattern**: Use SQL queries to verify:
     - Records exist where they should (migrations created them)
     - Fields are populated where they should be (migrations populated them)
     - Relationships are correct (foreign keys point to existing records)
   - **Example verification queries**:
     - Check for `project_language_link_local` records created from `project.target_language_id`:
       ```sql
       SELECT COUNT(*) FROM ps_data_local__project_language_link_local 
       WHERE json_extract(data, '$.project_id') = 'test-project-id';
       ```
     - Verify `languoid_local` records exist for referenced languages:
       ```sql
       SELECT COUNT(*) FROM ps_data_local__languoid_local 
       WHERE id IN ('test-language-id-1', 'test-language-id-2');
       ```
     - Check that `languoid_id` fields are populated:
       ```sql
       SELECT COUNT(*) as total,
              COUNT(CASE WHEN json_extract(data, '$.languoid_id') IS NOT NULL THEN 1 END) as with_languoid_id
       FROM ps_data_local__project_language_link_local;
       ```
   - **Identify any tables or fields** that migrations were expected to modify but didn't

4. **Verify Migration Success**
   - **Run comprehensive verification queries** to confirm all migrations completed successfully:
     - **Schema version check**: Query all local tables to verify all records are at target version
       ```sql
       -- Should return only the target version
       SELECT DISTINCT json_extract(json(json_extract(data, '$._metadata')), '$.schema_version') as version
       FROM ps_data_local__project_local
       WHERE json_extract(data, '$._metadata') IS NOT NULL;
       ```
     - **Migration-specific data verification**: For each migration, verify:
       - New records were created (if migration creates records)
       - Fields were populated (if migration populates fields)
       - Data transformations happened correctly (if migration transforms data)
     - **Field population check**: Query for NULL values in fields that should have been populated:
       ```sql
       -- Example: Check for records missing fields that migration should populate
       SELECT COUNT(*) FROM ps_data_local__project_local 
       WHERE json_extract(data, '$.versification_template') IS NULL;
       -- Should return 0 if migration populated this field
       ```
     - **Relationship integrity**: Verify foreign key relationships are correct:
       ```sql
       -- Example: Check languoid_id references point to existing languoids
       SELECT COUNT(*) FROM ps_data_local__project_language_link_local pll
       LEFT JOIN ps_data_local__languoid_local l ON l.id = json_extract(pll.data, '$.languoid_id')
       WHERE json_extract(pll.data, '$.languoid_id') IS NOT NULL AND l.id IS NULL;
       -- Should return 0 if all references are valid
       ```
   - **Compare actual vs expected**: Compare query results against expected state from migration descriptions
   - **Test case verification**: Verify each test case created in step 0 has the expected post-migration state

5. **Analyze Migration Path**
   - If current version < target version, show which migrations would execute
   - Display migration descriptions and expected steps
   - Check if migration path is complete (no gaps between versions)
   - Verify migrations are registered in correct order

6. **Check for Edge Cases**
   - **Identify data inconsistencies** that migrations should have resolved:
     - **Missing required fields**: Query for records where fields that migrations should populate are still NULL
       ```sql
       -- Example: Check for records missing fields after migration
       SELECT COUNT(*) FROM ps_data_local__project_language_link_local
       WHERE json_extract(data, '$.languoid_id') IS NULL 
         AND json_extract(data, '$.language_id') IS NOT NULL;
       ```
     - **Invalid foreign key references**: Query for references that point to non-existent records (LEFT JOIN checks)
       ```sql
       -- Example: Verify languoid_id references exist
       SELECT pll.id FROM ps_data_local__project_language_link_local pll
       LEFT JOIN ps_data_local__languoid_local l ON l.id = json_extract(pll.data, '$.languoid_id')
       WHERE json_extract(pll.data, '$.languoid_id') IS NOT NULL AND l.id IS NULL;
       ```
     - **Relationship integrity**: Verify relationships between tables are correct using SQL JOIN queries
     - **Edge case scenarios**: Check for scenarios mentioned in migration comments:
       - Missing language records (migration should create minimal languoids)
       - Inactive records (migration may or may not process these)
       - Synced vs local data (migration should handle both)
       - Multiple references to same data (migration should deduplicate)
   - **Look for data inconsistencies** that migrations should have resolved but didn't

7. **Generate Brief Report**
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

8. **Cleanup Test Database**
   - **CRITICAL: Delete test cases database** - After completing the migration analysis, delete the test cases database file:
     ```bash
     rm testing/client-migrations/{@version}-test-cases.db
     ```
   - This ensures the test database doesn't accumulate and clutter the testing/client-migrations directory

**IMPORTANT**: 
- **Always ask the user for `@version` first** - the version they want to test migrations from (e.g., "1.0", "2.0")
- **CRITICAL: Copy database BEFORE querying** - Always create `{@version}-test-cases.db` copy from `{@version}.db` before running any queries or test cases
- **Database query approach**: After migrations run, query the database directly using `sqlite3` on the simulator database path (shown in replace-device-db.sh output). Alternatively, use MCP local-db tools if available.
- **Migration execution**: Migrations run through the MigrationScreen UI component. The app will detect migrations are needed and show the migration screen. Migrations execute automatically or can be manually triggered.
- **Wait for completion**: After restarting the app, wait for migrations to complete (check database schema version). Initial wait of 8 seconds may not be enough - migrations may take longer depending on data volume.
- **Query timing**: 
  - Query immediately after app restart to see pre-migration state
  - Query again after migrations complete to verify post-migration state
  - If schema version hasn't changed, migrations may still be running or need manual trigger
- **Database path**: The replace-device-db.sh script outputs the database path. Use this path for direct SQLite queries.
- **Query approach**: Use PowerSync raw table names (e.g., `ps_data_local__project_local`) and query JSON data column directly
- **Test data approach**: Create test data that covers all migration scenarios, not just the first migration. Consider the entire migration path from `@version` to target version.
- **Verification approach**: Verify each migration step individually, then verify the final state matches the target version
- Use `@version` consistently throughout the analysis to reference the test version
