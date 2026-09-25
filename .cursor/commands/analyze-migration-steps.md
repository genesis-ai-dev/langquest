Analyze migration steps and verify migration status:

---

## PHASE 1: Initial Setup

0. **Prepare Test Database Environment**
   - **Ask the user**: "Which version do you want to test migrations from? (e.g., '2.4', '2.5')"
   - Store the user's response as `@version` variable
   - Check for database files in `testing/client-migrations/` directory matching `{@version}.db`
   - If no matching database found, inform the user and ask if they want to create one or use a different version
   - **CRITICAL: Copy database BEFORE querying content** - Create a fresh test copy directly from `{@version}.db` to `{@version}-test-cases.db`:
     ```bash
     cp testing/client-migrations/{@version}.db testing/client-migrations/{@version}-test-cases.db
     ```
   - **CRITICAL: Revert any changes to source database** - After copying, revert any git changes to ensure the original database file is untouched:
     ```bash
     git checkout testing/client-migrations/{@version}.db
     ```

---

## PHASE 2: Migration Analysis (BEFORE inserting test data)

1. **Analyze Registered Migrations**
   - Read `db/migrations/index.ts` to identify registered hops and verify that a hop exists starting from `@version`
   - Also read `db/migrations/upgradeToSingleTable.ts` if the path includes or crosses **2.5 → 2.6** (layout collapse is not in `2.5-to-2.6.ts`)
   - List all hops registered in `db/migrations/index.ts`
   - Show path: from version → to version → description
   - Identify which hops would run starting from `@version`
   - Note which hop was tested based on `@version` and the test database used

2. **Analyze Migration Path**
   - If current version < target version (`APP_SCHEMA_VERSION` in `db/constants.ts`), show which hops would execute
   - Display descriptions and expected steps
   - Check if the path is complete (no gaps between versions)
   - Verify hops are registered in order
   - **If path has gaps or issues, STOP and inform user before proceeding**
   - If the path includes 2.5 → 2.6, note that `prepareSingleTableLayout()` copies `*_synced` into `ps_data__*`, stages unpublished `*_local` rows to JSON, drops leftover triplicate objects, then `reinsertUnpublishedDrafts()` runs after PowerSync init

---

## PHASE 3: Test Data Preparation

3. **Insert Test Data for Migration Testing**
   - Insert test data directly into the test database file using SQLite commands that represent the pre-migration state (version `@version`). The test data should match what the hops (and one-shot, if any) expect:
   - **Read all hop files** in the path from `@version` to target version. If the path includes 2.5 → 2.6, also read `upgradeToSingleTable.ts`.
   - **Identify requirements** by analyzing:
     - **ALL fields that hops will read** — every `jsonExtractColumns()` call and `json_extract()` usage
     - Legacy fields hops will read from
     - New fields/tables hops will create
     - Fields hops will populate
     - Edge cases in comments (missing records, unpublished vs published)
     - **Field dependencies**: Some hops use `COALESCE()` or fallback logic
   - **Create comprehensive test data** that covers:
     - **Legacy field scenarios**: Records with legacy fields hops will transform
     - **Reference data**: Supporting records hops will use to create new records
     - **Missing data scenarios**: Records that reference data that may or may not exist
     - **Field population scenarios**: NULL fields hops will backfill
     - **Multiple hop coverage**: Data that exercises every hop in the path
     - **If crossing 2.5 → 2.6**: at least one unpublished draft that exists only in `ps_data_local__quest_local` (and related asset/qal/acl rows), plus at least one row only in `ps_data__quest_synced` (must get `published_at` stamped, must not lose the draft)
   - **Test data structure**:
     - Use PowerSync raw table names and insert into the `data` column as JSON
     - **`@version` < 2.6**: drafts in `ps_data_local__{entity}_local`; downloaded cache in `ps_data__{entity}_synced`
     - **`@version` ≥ 2.6**: everything in `ps_data__{entity}` (unpublished quests have `"published_at": null`)
     - **CRITICAL: Include ALL fields that hops will read**
     - **For version 0.0**: Do NOT include `_metadata` (0.0→1.0 will add it)
     - **For version 1.0+**: Include `_metadata` with `schema_version: "@version"`
     - Do NOT insert records/tables hops are expected to create
     - Do NOT include fields hops are expected to populate (leave them NULL or missing)
   - **Generate real UUIDs** using `uuidgen` (macOS/Linux) or `uuid`. Never use fake IDs like "test-record-id".
   - **Insert test data** with `sqlite3` using those UUIDs
   - **CRITICAL CHECKLIST before inserting test data**:
     - [ ] Read ALL hop files in the path (and `upgradeToSingleTable.ts` if crossing 2.6)
     - [ ] For COALESCE/fallback logic: include primary AND fallback fields
     - [ ] For foreign keys: include the legacy FK field hops will transform
     - [ ] For conditional logic: include the field hops check for branching
     - [ ] Test data matches pre-migration state (no fields hops will create/populate)
     - [ ] Real UUIDs for all ID fields
     - [ ] Version 0.0 records have NO `_metadata`
     - [ ] Raw table names match `@version` (triplicate vs unsuffixed)

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
   - **CRITICAL: Wait for app initialization** - After restarting the app, wait 8 seconds for the app to initialize and potentially run migrations:
     ```bash
     sleep 8
     ```
   - **IMPORTANT**: After waiting:
     - Migrations run through `MigrationScreen`. The app may show that screen until hops and `prepareSingleTableLayout()` finish. PowerSync is constructed only after leftover 2.5 `*_local` tables are gone.
     - Query the database with `sqlite3` on the simulator path from replace-device-db.sh output
     - The path will be shown in that output (e.g. `/Users/.../Library/sqlite.db` or Android `databases/sqlite.db`)
     - **Alternative**: If MCP local-db tools are available, use those
     - After success, unpublished 2.5 drafts should be in unsuffixed `ps_data__*` (re-inserted via Drizzle), not in `ps_data_local__*`

---

## PHASE 5: Verification

6. **Check Current Schema Version**
   - Read `_metadata.schema_version` with `json_extract()` from the `data` column
   - **`@version` < 2.6 going to 2.6+**: leftover `ps_data_local__*` tables should be **gone**. Stamp lives on unsuffixed `ps_data__*`.
   - **Already 2.6+**: query unsuffixed `ps_data__{entity}` only
   - Ignore unsuffixed rows with **no** `_metadata` — those are PowerSync downloads, not a failed hop
   - Client-stamped rows should show target `APP_SCHEMA_VERSION` from `db/constants.ts`
   - Intermediate versions on stamped rows mean the hop chain stopped early

7. **Check Migration Status**
   - For each hop in the path, check new records, field population, and transforms
   - **If the path includes 2.5 → 2.6**:
     - No `ps_data_local__*` tables and no `ps_data__*_synced` tables
     - No leftover union views (`quest_aggregates` combining `_local` / `_synced`)
     - Unpublished draft ids from `*_local` exist in `ps_data__*` with `published_at` null
     - Former `*_synced` quests have `published_at` set (created_at or equivalent)
     - Live 2.6 drafts created after the hop were not mass-stamped published
   - Use SQL to verify records exist, fields are populated, and FKs point at real rows

8. **Verify Migration Success**
   - Schema version on **client-stamped** unsuffixed rows (or leftover `*_local` if still on a pre-2.6 target)
   - Per-hop data checks (creates, backfills, transforms)
   - Each test case from step 3 has the expected post-migration state

9. **Check for Edge Cases**
   - Missing required fields hops should have populated
   - Invalid foreign keys (LEFT JOIN)
   - Unpublished vs published (`published_at` null vs set) — not "local vs synced tables"
   - Inactive records (hop may or may not process these)
   - Duplicate references (hop should deduplicate if it says so)

---

## PHASE 6: Wrap-up

10. **Generate Brief Report**
    - **Migration Path**: hops that ran (`@version` → target) plus whether the 2.5 → 2.6 one-shot ran
    - **Migration Status**: completed, partial, failed, or pending
    - **Schema Version**: stamped version vs `APP_SCHEMA_VERSION`
    - **Test Case Results**: pass/fail for key scenarios (include unpublished-draft survival if crossing 2.6)
    - **Key Findings**: records created/modified, fields populated, leftover triplicate gone or not
    - **Issues/Warnings**
    - **Recommendations** if issues were found
    - Keep it concise

11. **Cleanup Test Database**
    ```bash
    rm testing/client-migrations/{@version}-test-cases.db
    ```

---

## IMPORTANT NOTES

- **Always ask the user for `@version` first**
- **Copy `{@version}.db` to `{@version}-test-cases.db` before any queries**
- Analyze hops BEFORE inserting test data
- Raw names: pre-2.6 `ps_data_local__quest_local` / `ps_data__quest_synced`; 2.6+ `ps_data__quest`
- Unsuffixed unversioned rows are downloads — do not treat them as version `0.0`
- Do not stamp `published_at` on every `ps_data__quest` row when verifying 2.6
- Migrations run through `MigrationScreen`; layout upgrade runs before PowerSync is constructed
- After restart, wait for the screen to finish (8s may not be enough)
- Use real UUIDs throughout
- Use `@version` consistently
