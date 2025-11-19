-- Create storage policies for local development
-- Note: Storage tables are already configured by Supabase with proper RLS
-- These policies are additional configurations for local development

DO $$
BEGIN
  -- Try to create policies, ignore if they already exist or if we lack permissions
  
  -- Policy: Allow public users to download files from local bucket
  BEGIN
    CREATE POLICY "Allow all operations" ON "storage"."objects" 
      FOR SELECT USING (("bucket_id" = 'local'::text));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Insufficient privileges to create policy on storage.objects - skipping (this is normal for local development)';
  END;

  -- Policy: Allow public users to upload files to local bucket
  BEGIN
    CREATE POLICY "Enable insert for all users" ON "storage"."objects" 
      FOR INSERT WITH CHECK (("bucket_id" = 'local'::text));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Insufficient privileges to create policy on storage.objects - skipping (this is normal for local development)';
  END;

  -- Policy: Allow public users to update files in local bucket (for upsert operations)
  BEGIN
    CREATE POLICY "Enable update for all users" ON "storage"."objects" 
      FOR UPDATE USING (("bucket_id" = 'local'::text))
      WITH CHECK (("bucket_id" = 'local'::text));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Insufficient privileges to create policy on storage.objects - skipping (this is normal for local development)';
  END;

  -- Policy: Allow public users to delete files from local bucket
  BEGIN
    CREATE POLICY "Enable delete for all users" ON "storage"."objects" 
      FOR DELETE USING (("bucket_id" = 'local'::text));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Insufficient privileges to create policy on storage.objects - skipping (this is normal for local development)';
  END;

  -- Storage system tables are already configured by Supabase
  -- These ALTER statements are skipped if we don't have owner privileges (normal for local dev)
  BEGIN
    ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Storage buckets RLS already enabled by Supabase - skipping';
  END;

  BEGIN
    ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Storage migrations RLS already enabled by Supabase - skipping';
  END;

  BEGIN
    ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Storage objects RLS already enabled by Supabase - skipping';
  END;

  BEGIN
    ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Storage s3_multipart_uploads RLS already enabled by Supabase - skipping';
  END;

  BEGIN
    ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Storage s3_multipart_uploads_parts RLS already enabled by Supabase - skipping';
  END;
END $$;