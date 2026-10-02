-- PowerSync only replicates tables in the powersync publication. Without
-- these, server-stamped uploaded_at / audio_uploaded_at never sync down and
-- the review upload progress stays pending.
-- No APP_SCHEMA_VERSION / get_schema_info() bump.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'powersync' and schemaname = 'public' and tablename = 'review'
  ) then
    alter publication powersync add table public.review;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'powersync' and schemaname = 'public' and tablename = 'review_asset'
  ) then
    alter publication powersync add table public.review_asset;
  end if;
end $$;
