-- Path A: anon RPC so an external reviewer can submit a review.
-- Authorization is the review access token (validate_review_token).
-- On success the token is cleared and the review moves to submitted.
-- No APP_SCHEMA_VERSION / get_schema_info() bump.

-- Returns when every object in p_audio exists in storage, else null.
-- Not granted to anon or authenticated.
create or replace function public.review_audio_uploaded_at(p_audio jsonb)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
           when count(o.name) = count(*) then max(o.created_at)
         end
    from jsonb_array_elements_text(p_audio) as elem(name)
    left join storage.objects o on o.name = elem.name
   where p_audio is not null
     and jsonb_typeof(p_audio) = 'array'
     and jsonb_array_length(p_audio) > 0;
$$;

revoke all on function public.review_audio_uploaded_at(jsonb) from public;
revoke all on function public.review_audio_uploaded_at(jsonb) from anon, authenticated;

-- Checks that p_audio is null or an array of {name}.{extension} object names
-- at the bucket root (no folders). Returns null for null or an empty array.
-- Not granted to anon or authenticated.
create or replace function public.normalize_review_audio(
  p_audio jsonb,
  p_field text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name jsonb;
begin
  if p_audio is null or jsonb_typeof(p_audio) = 'null' then
    return null;
  end if;

  if jsonb_typeof(p_audio) <> 'array' then
    raise exception '% must be an array or null', p_field
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_audio) = 0 then
    return null;
  end if;

  for v_name in select value from jsonb_array_elements(p_audio) loop
    if jsonb_typeof(v_name) <> 'string'
       or (v_name #>> '{}') !~ '^[^/.][^/]*\.[A-Za-z0-9]+$'
       or position(chr(92) in v_name #>> '{}') > 0 then
      raise exception '% must contain {name}.{extension} file names', p_field
        using errcode = '22023';
    end if;
  end loop;

  return p_audio;
end;
$$;

revoke all on function public.normalize_review_audio(jsonb, text) from public;
revoke all on function public.normalize_review_audio(jsonb, text) from anon, authenticated;

create or replace function public.submit_quest_review(
  review_id uuid,
  token text,
  payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_review public.review%rowtype;
  v_reviewer jsonb;
  v_quest_result text;
  v_conclusion text;
  v_audio jsonb;
  v_assets jsonb;
  v_item jsonb;
  v_asset_id uuid;
  v_asset_ids uuid[] := '{}';
  v_asset_result text;
  v_comment text;
  v_asset_audio jsonb;
  v_concluded_at timestamptz := now();
begin
  if not public.validate_review_token(review_id, token) then
    raise exception 'The review is not available for submission'
      using errcode = '28000';
  end if;

  -- Lock the row so two submissions with the same token cannot both apply.
  select r.*
    into v_review
    from public.review r
   where r.id = submit_quest_review.review_id
     and r.access_token = submit_quest_review.token
     and r.status = 'in_progress'
     and r.active
     for update;

  if not found then
    raise exception 'The review is not available for submission'
      using errcode = '28000';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'payload must be an object'
      using errcode = '22023';
  end if;

  v_reviewer := payload #> '{metadata,reviewer}';
  if v_reviewer is not null
     and jsonb_typeof(v_reviewer) not in ('object', 'null') then
    raise exception 'metadata.reviewer must be an object'
      using errcode = '22023';
  end if;
  if jsonb_typeof(v_reviewer) = 'null' then
    v_reviewer := null;
  end if;

  v_quest_result := payload ->> 'quest_result';
  if v_quest_result is null
     or v_quest_result not in ('approved', 'suggested_changes') then
    raise exception 'quest_result must be approved or suggested_changes'
      using errcode = '22023';
  end if;

  v_conclusion := nullif(btrim(payload ->> 'conclusion'), '');

  v_audio := public.normalize_review_audio(
    payload -> 'audio', 'audio'
  );

  v_assets := coalesce(payload -> 'assets', '[]'::jsonb);
  if jsonb_typeof(v_assets) = 'null' then
    v_assets := '[]'::jsonb;
  end if;
  if jsonb_typeof(v_assets) <> 'array' then
    raise exception 'assets must be an array'
      using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(v_assets) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each entry in assets must be an object'
        using errcode = '22023';
    end if;

    begin
      v_asset_id := (v_item ->> 'asset_id')::uuid;
    exception
      when invalid_text_representation then
        v_asset_id := null;
    end;

    if v_asset_id is null then
      raise exception 'assets.asset_id must be a uuid'
        using errcode = '22023';
    end if;

    if v_asset_id = any (v_asset_ids) then
      raise exception 'Asset % appears more than once', v_asset_id
        using errcode = '22023';
    end if;
    v_asset_ids := v_asset_ids || v_asset_id;

    if not exists (
      select 1
        from public.quest_asset_link qal
        join public.asset a
          on a.id = qal.asset_id
         and a.active
       where qal.quest_id = v_review.quest_id
         and qal.asset_id = v_asset_id
         and qal.active
    ) then
      raise exception 'Asset % is not part of the reviewed quest', v_asset_id
        using errcode = '22023';
    end if;

    v_asset_result := v_item ->> 'asset_result';
    if v_asset_result is not null
       and v_asset_result not in ('not_reviewed', 'approved', 'suggested_changes') then
      raise exception 'Invalid asset_result for asset %', v_asset_id
        using errcode = '22023';
    end if;

    v_comment := nullif(btrim(v_item ->> 'comment'), '');

    v_asset_audio := public.normalize_review_audio(
      v_item -> 'audio', 'assets.audio'
    );

    -- audio_uploaded_at comes from storage, not from the payload.
    insert into public.review_asset as ra (
      review_id,
      asset_id,
      asset_result,
      comment,
      audio,
      audio_uploaded_at
    )
    values (
      v_review.id,
      v_asset_id,
      v_asset_result,
      v_comment,
      v_asset_audio,
      public.review_audio_uploaded_at(v_asset_audio)
    )
    on conflict on constraint review_asset_pkey do update
      set asset_result = excluded.asset_result,
          comment = excluded.comment,
          audio = excluded.audio,
          audio_uploaded_at = excluded.audio_uploaded_at;
  end loop;

  -- Keep existing metadata keys. Only reviewer is added or replaced.
  update public.review r
     set status = 'submitted',
         access_token = null,
         quest_result = v_quest_result,
         conclusion = v_conclusion,
         audio = v_audio,
         audio_uploaded_at = public.review_audio_uploaded_at(v_audio),
         concluded_at = v_concluded_at,
         metadata = (
           case
             when v_reviewer is null then public.unwrap_review_metadata(r.metadata)
             else public.unwrap_review_metadata(r.metadata)
                    || jsonb_build_object('reviewer', v_reviewer)
           end
         )::text
   where r.id = v_review.id;

  return jsonb_build_object(
    'id', v_review.id,
    'status', 'submitted',
    'concluded_at', v_concluded_at
  );
end;
$$;

comment on function public.submit_quest_review(uuid, text, jsonb) is
  'Submits an external review. Callable with the anon key. Requires validate_review_token to pass. Writes quest_result, conclusion, audio and per-asset rows from payload, adds payload.metadata.reviewer to review.metadata, clears access_token, and sets status to submitted. audio_uploaded_at is computed from storage.objects. Audio entries must be {name}.{extension} file names at the bucket root.';

revoke all on function public.submit_quest_review(uuid, text, jsonb) from public;
revoke all on function public.submit_quest_review(uuid, text, jsonb) from authenticated;
grant execute on function public.submit_quest_review(uuid, text, jsonb) to anon;
