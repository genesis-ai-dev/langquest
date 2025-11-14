Testing checklist for your commits
Commit 1: c3bd0fb2 - Expiration logic moved to database + query patterns
Membership expiration (database-level)

[ ] Invite expiration
[ ] Create an invite >7 days old (manually set last_updated in DB)
[ ] Verify expired invites cannot be accepted (RLS should block)
[ ] Verify expired invites can be declined/withdrawn
[ ] Verify expired status shows correctly in UI
[ ] Request expiration
[ ] Create a request >7 days old
[ ] Verify project owners cannot accept expired requests
[ ] Verify expired requests can be declined/withdrawn
[ ] Database migration
[ ] Verify migration 20251111225430_prevent_accepting_expired_invites_requests.sql runs successfully
[ ] Verify RLS policies prevent accepting expired invites/requests
[ ] Verify expired status is computed in PowerSync system views
Vote trigger fix
[ ] Verify migration 20251111130512_fix_vote_trigger_use_asset_id.sql runs successfully
[ ] Submit a vote on a translation
[ ] Verify vote is recorded correctly (uses asset_id not translation_id)
Query pattern improvements
[ ] Verify useProjects hook works (removed unnecessary enableCloudQuery: false)
[ ] Verify useAssets hook works with simplified query patterns
[ ] Verify query invalidation patterns work correctly
UI/Component updates
[x] Verify loading indicators use ActivityIndicator instead of Loader2Icon
[x] Verify FormSubmit uses Button component with loading prop
[x] Verify color usage with getThemeColor utility
Commit 2: 2af770d8 - Remove 'pending' status filter from sync rules
Sync rules changes
[x] Verify invites sync correctly (removed 'pending' filter from sync-rules.yml)
[x] Verify requests sync correctly
[ ] Test sync behavior when going offline/online
[ ] Verify expired invites/requests are handled correctly in sync
Commit 3: 46067cfa - Quest data fetching refactor
Quest pagination
[ ] Load quest list with pagination (scroll to load more)
[ ] Verify pagination works offline (now uses useHybridPaginatedInfiniteData)
[ ] Verify pagination works online
[ ] Test search filtering with pagination
[ ] Verify data structure is flattened correctly (infiniteData.pages.flatMap)
[ ] Verify quest search by name/description works offline and online
Summary: Focus on membership expiration (database changes), sync rules (removed filter), and quest pagination (refactor).