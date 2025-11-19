-- ================================================================
-- COPY EXISTING STORAGE POLICIES FOR ASSETS BUCKET
-- ================================================================
-- 
-- This migration recreates the existing storage policies from the preview branch
-- for the 'assets' bucket. These policies allow public (including authenticated 
-- and anonymous) users to upload and download files from the assets bucket.
--
-- This migration also removes the generic "Enable insert for all users" policy
-- which is too broad and replaces it with bucket-specific policies.
--
-- Existing policies being recreated:
--   - "Upload files 1bqp9qb_0" - INSERT policy for assets bucket
--   - "Download files 1bqp9qb_0" - SELECT policy for assets bucket
--
-- Policies being removed:
--   - "Enable insert for all users" - Generic INSERT policy (too broad)
--
-- Affected tables:
--   - storage.objects (RLS policies)
-- ================================================================

-- Drop the generic policy that's too broad
drop policy if exists "Enable insert for all users" on storage.objects;

-- Drop existing bucket-specific policies if they exist
drop policy if exists "Upload files 1bqp9qb_0" on storage.objects;
drop policy if exists "Download files 1bqp9qb_0" on storage.objects;

-- Policy: Allow public users to upload files to assets bucket
-- This recreates the "Upload files 1bqp9qb_0" policy
create policy "Upload files 1bqp9qb_0"
on storage.objects
for insert
to public
with check (
  bucket_id = 'assets'
);

-- Policy: Allow public users to download files from assets bucket
-- This recreates the "Download files 1bqp9qb_0" policy
create policy "Download files 1bqp9qb_0"
on storage.objects
for select
to public
using (
  bucket_id = 'assets'
);

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
-- Summary:
-- ✅ Removed generic "Enable insert for all users" policy
-- ✅ Recreated INSERT policy "Upload files 1bqp9qb_0" for assets bucket
-- ✅ Recreated SELECT policy "Download files 1bqp9qb_0" for assets bucket
-- 
-- Note: These policies use 'public' role which includes both authenticated
-- and anonymous users. If you need UPDATE/DELETE policies for upsert
-- operations, those will need to be added separately.
-- ================================================================

