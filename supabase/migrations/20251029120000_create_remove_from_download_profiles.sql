-- Create remove_from_download_profiles functions (reverse of add_to_download_profiles)
-- Date: 2025-10-29
--
-- These functions remove a user's profile ID from download_profiles arrays,
-- enabling the undownload/offload functionality using the discovery approach.

SET search_path = public;

-- Function to remove profile from download_profiles for single-key tables
CREATE OR REPLACE FUNCTION public.remove_from_download_profiles(
  p_table_name text,
  p_record_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sql text;
  v_user_id uuid;
  v_rows_affected integer;
BEGIN
  -- Get current user ID from auth context
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Build dynamic SQL to remove profile from array
  v_sql := format(
    'UPDATE %I 
     SET download_profiles = array_remove(download_profiles, $1)
     WHERE id = $2
     AND download_profiles @> ARRAY[$1]::uuid[]',
    p_table_name
  );

  -- Execute the update
  EXECUTE v_sql USING v_user_id, p_record_id;
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  -- Return true if a row was updated
  RETURN v_rows_affected > 0;
END;
$$;

-- Function to remove profile from download_profiles for composite-key link tables
CREATE OR REPLACE FUNCTION public.remove_from_download_profiles_link(
  p_table_name text,
  p_key1_name text,
  p_key1_value uuid,
  p_key2_name text,
  p_key2_value uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sql text;
  v_user_id uuid;
  v_rows_affected integer;
BEGIN
  -- Get current user ID from auth context
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Build dynamic SQL to remove profile from array using composite key
  v_sql := format(
    'UPDATE %I 
     SET download_profiles = array_remove(download_profiles, $1)
     WHERE %I = $2 
     AND %I = $3
     AND download_profiles @> ARRAY[$1]::uuid[]',
    p_table_name,
    p_key1_name,
    p_key2_name
  );

  -- Execute the update
  EXECUTE v_sql USING v_user_id, p_key1_value, p_key2_value;
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  -- Return true if a row was updated
  RETURN v_rows_affected > 0;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.remove_from_download_profiles(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_from_download_profiles_link(text, text, uuid, text, uuid) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.remove_from_download_profiles IS 
'Removes the current user''s profile ID from a record''s download_profiles array.
Used for undownloading/offloading individual records.
Returns true if a row was updated, false if already removed or record not found.';

COMMENT ON FUNCTION public.remove_from_download_profiles_link IS 
'Removes the current user''s profile ID from a link table record''s download_profiles array.
Used for undownloading/offloading link tables with composite keys (quest_asset_link, etc.).
Returns true if a row was updated, false if already removed or record not found.';

