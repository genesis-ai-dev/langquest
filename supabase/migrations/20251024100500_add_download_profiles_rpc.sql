-- Function: add_to_download_profiles
-- Assumes each target table has: id uuid PRIMARY KEY, download_profiles uuid[] (nullable)

create or replace function public.add_to_download_profiles(
  p_table_name text,
  p_record_id  uuid
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_sql text;
  v_rows_affected int;
begin
  -- Get authenticated user
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate table name (prevent SQL injection)
  if p_table_name not in (
    'quest', 'project', 'asset', 'asset_content_link',
    'vote', 'tag', 'language'
  ) then
    raise exception 'Invalid table name: %', p_table_name;
  end if;

  -- Append user id if not already present
  v_sql := format(
    'update %I
       set download_profiles = array_append(download_profiles, $1)
     where id = $2
       and not ($1 = any(coalesce(download_profiles, array[]::uuid[])))',
    p_table_name
  );

  execute v_sql using v_user_id, p_record_id;
  get diagnostics v_rows_affected = row_count;

  return v_rows_affected > 0;
end;
$$;

-- Optional: allow logged-in users to call it (adjust to your needs)
grant execute on function public.add_to_download_profiles(text, uuid) to authenticated;

-- Function: add_to_download_profiles_link
-- Assumes link tables include: download_profiles uuid[] (nullable)

create or replace function public.add_to_download_profiles_link(
  p_table_name  text,
  p_key1_name   text,
  p_key1_value  uuid,
  p_key2_name   text,
  p_key2_value  uuid
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_sql text;
  v_rows_affected int;
begin
  -- Authenticated user required
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate table name
  if p_table_name not in ('quest_asset_link', 'quest_tag_link', 'asset_tag_link') then
    raise exception 'Invalid table name: %', p_table_name;
  end if;

  -- Validate key column names per table (prevents SQL injection)
  if (p_table_name = 'quest_asset_link' and not (p_key1_name = 'quest_id' and p_key2_name = 'asset_id'))
     or (p_table_name = 'quest_tag_link' and not (p_key1_name = 'quest_id' and p_key2_name = 'tag_id'))
     or (p_table_name = 'asset_tag_link' and not (p_key1_name = 'asset_id' and p_key2_name = 'tag_id')) then
    raise exception 'Invalid column names for table %', p_table_name;
  end if;

  -- Append user id if not already present (atomic)
  v_sql := format(
    'update %I
        set download_profiles = array_append(download_profiles, $1)
      where %I = $2
        and %I = $3
        and not ($1 = any(coalesce(download_profiles, array[]::uuid[])))',
    p_table_name, p_key1_name, p_key2_name
  );

  execute v_sql using v_user_id, p_key1_value, p_key2_value;
  get diagnostics v_rows_affected = row_count;

  return v_rows_affected > 0;
end;
$$;

-- Optional: allow logged-in users to call it (adjust as needed)
grant execute on function public.add_to_download_profiles_link(text, text, uuid, text, uuid) to authenticated;
