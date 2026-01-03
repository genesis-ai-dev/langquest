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
     - Read the migration file (e.g., `db/migrations/1.0-to-2.0.ts`) to understand what pre-migration data structure it expects
     - For migration `1.0-to-2.0.ts`, insert test data that includes:
       - `project_local` records with `target_language_id` in JSON (legacy field, schema_version: "@version")
       - `language_local` records (for local languages)
       - `language` records (for synced languages, if testing synced data)
       - `asset_content_link_local` records with `source_language_id` in JSON (schema_version: "@version")
       - Ensure records have `_metadata` with `schema_version: "@version"` to match the source version
       - Do NOT insert `project_language_link_local` records (migration should create these)
       - Do NOT insert `languoid_local` records (migration should create these)
       - Do NOT include `languoid_id` fields (migration should populate these)
     - Use PowerSync raw table names (e.g., `ps_data_local__project_local`) and insert into the `data` column as JSON
     - Insert test data directly into the SQLite file using `sqlite3` command:
       ```bash
       sqlite3 testing/client-migrations/{@version}-test-cases.db <<EOF
       INSERT INTO ps_data_local__project_local (id, data) VALUES (
         'test-project-id',
         json_object(
           'id', 'test-project-id',
           'target_language_id', 'test-language-id',
           'active', 1,
           '_metadata', json_object('schema_version', '@version')
         )
       );
       -- Add more test data INSERT statements based on migration requirements
       EOF
       ```
     - Insert test data that covers all migration scenarios described in the migration file comments (e.g., local languages, synced languages, missing languoids, etc.)
   - Run the replacement script:
     ```bash
     ./testing/client-migrations/replace-ios-sim-db.sh testing/client-migrations/{@version}-test-cases.db
     ```
   - After the script completes, restart the app manually:
     ```bash
     ./testing/client-migrations/restart-ios-sim-app.sh restart
     ```
   - **IMPORTANT**: After restarting the app:
     - **Use MCP local-db tools** to query the database directly after the app reopens to verify migration status
     - The MCP local-db connection will reflect the migrated database state in the iOS simulator

1. **Check Current Schema Version** (using MCP local-db)
   - Query the minimum schema version across all local tables using MCP local-db `execute_query`:
     ```sql
     SELECT 
       json_extract(json(json_extract(data, '$._metadata')), '$.schema_version') as schema_version,
       COUNT(*) as count
     FROM ps_data_local__project_local
     WHERE json_extract(data, '$._metadata') IS NOT NULL
     GROUP BY schema_version
     ORDER BY schema_version
     ```
   - Verify it matches the expected `APP_SCHEMA_VERSION` from `db/constants.ts`
   - Check if any records have outdated versions
   - Query other local tables to check for version consistency

2. **Analyze Registered Migrations**
   - List all migrations registered in `db/migrations/index.ts`
   - Show migration path: from version → to version → description
   - Identify which migrations would run starting from `@version` (the version specified by the user)
   - Note which migration was tested based on `@version` and the test database used

3. **Check Migration Status** (using MCP local-db)
   - Use MCP local-db `execute_query` to verify that migration-specific records were created (check tables mentioned in migration descriptions)
   - Query for missing foreign key relationships that migrations should have populated
   - Count records with vs without required fields populated after migration using SQL queries
   - Identify any tables or fields that migrations were expected to modify
   - Example queries:
     - Check for `project_language_link_local` records created from `project.target_language_id`
     - Verify `languoid_local` records exist for referenced languages
     - Check that `languoid_id` fields are populated in `project_language_link_local` and `asset_content_link_local`

4. **Verify Migration Success** (using MCP local-db)
   - Use MCP local-db `execute_query` to run verification queries:
     - Schema version check (should match target version) - query all local tables for schema_version
     - Verify migration-specific data was created/modified - check counts and relationships
     - Check population status of any new required fields - query for NULL values in fields that should be populated
   - Compare actual state (from MCP local-db queries) against expected state from migration descriptions

5. **Analyze Migration Path**
   - If current version < target version, show which migrations would execute
   - Display migration descriptions and expected steps
   - Check if migration path is complete (no gaps between versions)
   - Verify migrations are registered in correct order

6. **Check for Edge Cases** (using MCP local-db)
   - Use MCP local-db `execute_query` to identify records with missing required fields that should have been populated
   - Query for foreign key references that point to non-existent records (LEFT JOIN checks)
   - Verify relationships between tables are correct after migration using SQL JOIN queries
   - Look for data inconsistencies that migrations should have resolved
   - Example: Check for `project_language_link_local` records with NULL `languoid_id` when `language_id` exists

7. **Generate Report**
   - **CRITICAL: Save report in testing/client-migrations directory** - Create the analysis report file in `testing/client-migrations/` directory:
     - File path: `testing/client-migrations/migration-analysis-{@version}-to-{target-version}.md`
     - Example: For version 1.0 to 2.0, save as `testing/client-migrations/migration-analysis-1.0-to-2.0.md`
     - The report should be saved alongside the test databases and migration scripts
   - Summary of current state vs target state
   - Migration execution status based on database state
   - List any issues or warnings found in database
   - Provide recommendations for fixing any data inconsistencies if needed
   - Note any migrations that may need to be re-run or fixed

8. **Cleanup Test Database**
   - **CRITICAL: Delete test cases database** - After completing the migration analysis, delete the test cases database file:
     ```bash
     rm testing/client-migrations/{@version}-test-cases.db
     ```
   - This ensures the test database doesn't accumulate and clutter the testing/client-migrations directory

**IMPORTANT**: 
- **Always ask the user for `@version` first** - the version they want to test migrations from (e.g., "1.0", "2.0")
- **CRITICAL: Copy database BEFORE querying** - Always create `{@version}-test-cases.db` copy from `{@version}.db` before running any queries or test cases
- **CRITICAL: After reopening the app, use MCP local-db tools** (`mcp_local-db_execute_query`) to query the database directly
- The MCP local-db connection queries the iOS simulator's database, which will reflect the migrated state
- All database queries in steps 1-6 should use MCP local-db `execute_query` tool, not direct SQLite commands
- The replacement script terminates the app and replaces the database, then you manually restart it using `restart-ios-sim-app.sh restart`
- Use `@version` consistently throughout the analysis to reference the test version
- Use PowerSync raw table names (e.g., `ps_data_local__project_local`) when querying via MCP local-db

