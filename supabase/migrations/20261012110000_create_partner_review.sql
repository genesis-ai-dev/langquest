-- Path A: RPC for partner review API (POST /api/partner/v1/reviews).
-- Called only by the website route with the service role key after partner auth.
-- Creates a complete, already-submitted review. Idempotent on (origin, external_id).
-- No APP_SCHEMA_VERSION / get_schema_info() bump.

-- Idempotency: one review per (origin, external_id).
create unique index if not exists review_origin_external_id_key
  on public.review (origin, external_id)
  where external_id is not null;

create or replace function public.create_partner_review(
  p_origin text,
  p_external_id text,
  p_quest_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_download_profiles uuid[];
  v_review_id uuid;
  v_assets jsonb := coalesce(p_payload -> 'assets', '[]'::jsonb);
  v_ignored_assets jsonb;
begin
  if coalesce(trim(p_origin), '') = '' or coalesce(trim(p_external_id), '') = '' then
    raise exception 'origin and external_id are required' using errcode = '22023';
  end if;

  if coalesce(p_payload ->> 'quest_result', '') not in ('approved', 'suggested_changes') then
    raise exception 'quest_result must be approved or suggested_changes'
      using errcode = '22023';
  end if;

  select r.id
    into v_review_id
    from public.review r
   where r.origin = p_origin
     and r.external_id = p_external_id;

  if v_review_id is not null then
    return jsonb_build_object('id', v_review_id, 'duplicate', true);
  end if;

  select q.project_id, coalesce(q.download_profiles, '{}')
    into v_project_id, v_download_profiles
    from public.quest q
   where q.id = p_quest_id;

  if v_project_id is null then
    raise exception 'Quest % not found', p_quest_id using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(e ->> 'asset_id'), '[]'::jsonb)
    into v_ignored_assets
    from jsonb_array_elements(v_assets) e
   where not exists (
     select 1
       from public.quest_asset_link l
      where l.quest_id = p_quest_id
        and l.asset_id::text = e ->> 'asset_id'
        and l.active
   );

  insert into public.review (
    project_id,
    quest_id,
    profile_id,
    status,
    origin,
    external_id,
    quest_result,
    conclusion,
    metadata,
    audio,
    concluded_at,
    download_profiles
  )
  values (
    v_project_id,
    p_quest_id,
    null,
    'submitted',
    p_origin,
    p_external_id,
    p_payload ->> 'quest_result',
    p_payload ->> 'conclusion',
    coalesce(p_payload -> 'metadata', '{}'::jsonb)::text,
    coalesce(nullif(p_payload -> 'audio', 'null'::jsonb), '[]'::jsonb),
    now(),
    v_download_profiles
  )
  on conflict (origin, external_id) where external_id is not null do nothing
  returning id into v_review_id;

  if v_review_id is null then
    select r.id
      into v_review_id
      from public.review r
     where r.origin = p_origin
       and r.external_id = p_external_id;

    return jsonb_build_object('id', v_review_id, 'duplicate', true);
  end if;

  insert into public.review_asset (
    review_id,
    asset_id,
    project_id,
    asset_result,
    comment,
    audio,
    download_profiles
  )
  select
    v_review_id,
    (e ->> 'asset_id')::uuid,
    v_project_id,
    e ->> 'asset_result',
    e ->> 'comment',
    coalesce(nullif(e -> 'audio', 'null'::jsonb), '[]'::jsonb),
    v_download_profiles
  from jsonb_array_elements(v_assets) e
  where exists (
    select 1
      from public.quest_asset_link l
     where l.quest_id = p_quest_id
       and l.asset_id::text = e ->> 'asset_id'
       and l.active
  );

  return jsonb_build_object(
    'id', v_review_id,
    'duplicate', false,
    'ignored_assets', v_ignored_assets
  );
end;
$$;

comment on function public.create_partner_review(text, text, uuid, jsonb) is
  'Creates a submitted partner review. Service role only. Idempotent on (origin, external_id). Copies quest download_profiles for offline sync.';

revoke all on function public.create_partner_review(text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_partner_review(text, text, uuid, jsonb)
  to service_role;
