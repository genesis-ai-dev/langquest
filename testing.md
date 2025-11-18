Testing checklist for your commits
Commit 1: c3bd0fb2 - Expiration logic moved to database + query patterns
Membership expiration (database-level)

[x] Invite expiration
[x] Create an invite >7 days old (manually set last_updated in DB)
[x] Verify expired invites cannot be accepted (RLS should block)
[x] Verify expired invites can be renewed
[x] Verify expired status shows correctly in UI
[x] Request expiration
[x] Create a request >7 days old
[x] Verify project owners cannot accept expired requests
[x] Verify expired requests can be can be retryed
Database migration
[x] Verify migration 20251111225430_prevent_accepting_expired_invites_requests.sql runs successfully
[x] Verify RLS policies prevent accepting expired invites/requests
[x] Verify expired status is computed in PowerSync system views
Vote trigger fix
[x] Verify migration 20251111130512_fix_vote_trigger_use_asset_id.sql runs successfully
[x] Submit a vote on a translation
[x] Verify vote is recorded correctly (uses asset_id not translation_id)
Query pattern improvements - do on preview branch
[x] Verify useProjects hook works (removed unnecessary enableCloudQuery: false)
    → Test on: Projects page (NextGenProjectsView - route: 'projects')
    → What to test: Project list loads, pagination works, search works offline/online
[x] Verify useAssets hook works with simplified query patterns
    → Test on: Assets page (NextGenAssetsView - route: 'assets')
    → What to test: Assets list loads for a quest, search works, pagination works offline
[x] Verify query invalidation patterns work correctly
    → Test on: All pages that use these hooks (Projects, Assets, Quests)
    → What to test: After mutations (create/update/delete), queries refresh correctly
    → Key test: Quest creation relies on PowerSync reactivity (no manual invalidation)
    → Other mutations: Verify publish quest, create chapter, bulk download still work
UI/Component updates
[x] Verify loading indicators use ActivityIndicator instead of Loader2Icon
[x] Verify FormSubmit uses Button component with loading prop
[x] Verify color usage with getThemeColor utility
Commit 2: 2af770d8 - Remove 'pending' status filter from sync rules
Sync rules changes
[x] Verify invites sync correctly (removed 'pending' filter from sync-rules.yml)
[x] Verify requests sync correctly
[x] Test sync behavior when going offline/online
[x] Verify expired invites/requests are handled correctly in sync
Commit 3: 46067cfa - Quest data fetching refactor
Quest pagination
[x] Load quest list with pagination (scroll to load more)
    → Test on: Project Directory page (ProjectDirectoryView - route: 'quests')
    → Component: QuestListView (rendered inside ProjectDirectoryView)
[ ] Verify pagination works offline (now uses useHybridPaginatedInfiniteData)
    → Test on: Project Directory page → QuestListView
    → What to test: Scroll to load more quests, data loads from local PowerSync DB
    → Note: Skipped - same hook/logic as online pagination (already verified)
[x] Verify pagination works online
    → Test on: Project Directory page → QuestListView
    → What to test: Scroll to load more quests, data loads from Supabase
[x] Test search filtering with pagination
    → Test on: Project Directory page → QuestListView
    → What to test: Search quests by name/description, pagination continues to work
[ ] Verify data structure is flattened correctly (infiniteData.pages.flatMap)
    → Test on: Project Directory page → QuestListView
    → What to test: Quest list displays correctly (no nested arrays), all quests visible
    → Verified: AI tested with debug check - Console logs confirm isFlatArray=true, totalQuests matches sum of pageSizes
    - Keean: confirmed to look ok, have not confirmed in the code that things are actually working properly
[x] Verify quest search by name/description works offline and online
    → Test on: Project Directory page → QuestListView
    → What to test: Search works when offline (local DB) and online (Supabase)
Commit 4: 9a5678ec - Revert: remove client-side expiration filtering and revert worklet threading changes
Quest creation reactivity
[x] Verify quest creation appears automatically without manual query invalidation
    → Test on: Project Directory page → Create quest modal
    → What to test: Create a new quest, verify it appears in quest list immediately (PowerSync reactivity)
    → Test both: Online and offline scenarios
    → Verify: No console errors, quest appears without manual refresh
Asset query error handling
[x] Verify useAssetStatuses handles missing assetId correctly
    → Test on: Assets page (NextGenAssetsView)
    → What to test: Query should not run when assetId is missing (enabled: !!assetId)
[ ] Verify quest_asset_link query handles missing questId correctly
    → Test on: Assets page
    → What to test: Query should not run when questId is missing or asset error exists
    → Verify: enabled: !!assetId && !!questId && !isAssetError
    - I just tested that the query still works
Hybrid data hook improvements
[ ] Verify error handling improvements in useHybridData
    → Test on: Any page using useHybridData or useHybridPaginatedData
    → What to test: Cloud errors don't show when offline (isError: !!offlineError || (!!cloudError && isOnline))
    → Verify: isLoading logic fixed for paginated data (isOfflineLoading && isCloudLoading)
    → Test: Cloud query enabling logic (shouldFetchCloud respects enableCloudQuery && isOnline && enabled && !!cloudQueryFn)
    - I just tested that the query still works
Pagination improvements
[x] Verify simplified fetchNextPage/fetchPreviousPage works correctly
    → Test on: Project Directory page → QuestListView
    → What to test: Pagination works smoothly without isPlaceholderData checks
    → Test: Rapid page switching, verify no race conditions
Expiration logic in PowerSync views
[x] Verify expired status computed correctly in PowerSync system views
    → Test on: Projects page (invites/requests)
    → What to test: Expired invites/requests show 'expired' status in PowerSync views
    → Verify: CASE statements in system.ts work correctly (uncommented)
UI/Performance improvements
[x] Verify key changes in NextGenProjectsView prevent unnecessary re-renders
    → Test on: Projects page
    → What to test: Switching tabs doesn't cause full list re-render
    → Verify: Key changes (removed activeTab from key, added to keyExtractor)
Query invalidation patterns (continued)
[x] Verify mutations with manual invalidation still work correctly
    → Test: Publish quest (NextGenAssetsView), Create chapter, Bulk download
    → What to test: These mutations still refresh UI correctly after completion
    → Note: These still use manual invalidation (different pattern than createQuest)

Summary: Focus on membership expiration (database changes), sync rules (removed filter), and quest pagination (refactor).