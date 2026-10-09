-- Path A: anon RPC so an external reviewer can load the quest behind a review.
-- Authorization is the review access token. The function does not grant table access.
-- No APP_SCHEMA_VERSION / get_schema_info() bump.

-- metadata is text and is sometimes double-encoded JSON. Not granted to anon.
create or replace function public.unwrap_review_metadata(p_metadata text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_meta jsonb;
begin
  if p_metadata is null or btrim(p_metadata) = '' then
    return '{}'::jsonb;
  end if;

  begin
    v_meta := p_metadata::jsonb;
  exception
    when others then
      return '{}'::jsonb;
  end;

  if jsonb_typeof(v_meta) = 'string' then
    begin
      v_meta := (v_meta #>> '{}')::jsonb;
    exception
      when others then
        return '{}'::jsonb;
    end;
  end if;

  if jsonb_typeof(v_meta) is distinct from 'object' then
    return '{}'::jsonb;
  end if;

  return v_meta;
end;
$$;

revoke all on function public.unwrap_review_metadata(text) from public;
revoke all on function public.unwrap_review_metadata(text) from anon, authenticated;

create or replace function public.fetch_quest_review_data(
  review_id uuid,
  token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quest_id uuid;
  v_project_id uuid;
  v_template text;
  v_quest public.quest%rowtype;
  v_quest_meta jsonb;
  v_assets jsonb;
begin
  select r.quest_id, r.project_id
    into v_quest_id, v_project_id
    from public.review r
   where r.id = review_id
     and r.access_token is not null
     and token is not null
     and token <> ''
     and r.access_token = token
     and r.status = 'in_progress'
     and r.active;

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  select q.*
    into v_quest
    from public.quest q
   where q.id = v_quest_id;

  if not found or v_quest.active is not true or v_quest.visible is not true then
    return jsonb_build_object(
      'error', 'The review data could not be retrieved'
    );
  end if;

  select p.template
    into v_template
    from public.project p
   where p.id = v_project_id;

  v_quest_meta := public.unwrap_review_metadata(v_quest.metadata);

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', a.id,
               'name', qal.name,
               'order_index', qal.order_index,
               'metadata', jsonb_strip_nulls(
                 jsonb_build_object(
                   'verse', link_meta -> 'verse',
                   'pericope', link_meta -> 'pericope'
                 )
               ),
               'content', content.links
             )
             order by qal.order_index, a.id
           ),
           '[]'::jsonb
         )
    into v_assets
    from public.quest_asset_link qal
    join public.asset a
      on a.id = qal.asset_id
     and a.active
    cross join lateral (
      select public.unwrap_review_metadata(qal.metadata) as link_meta
    ) parsed
    left join lateral (
      select coalesce(
               jsonb_agg(
                 jsonb_build_object(
                   'text', acl.text,
                   'audio', acl.audio,
                   'order_index', acl.order_index
                 )
                 order by acl.order_index, acl.created_at, acl.id
               ),
               '[]'::jsonb
             ) as links
        from public.asset_content_link acl
       where acl.asset_id = a.id
         and acl.active
    ) content on true
   where qal.quest_id = v_quest.id
     and qal.active;

  return jsonb_build_object(
    'valid', true,
    'quest', jsonb_build_object(
      'id', v_quest.id,
      'name', v_quest.name,
      'description', v_quest.description,
      'template', v_template,
      'metadata', jsonb_strip_nulls(
        jsonb_build_object(
          'bible', v_quest_meta -> 'bible',
          'fia', v_quest_meta -> 'fia',
          'versionLabel', v_quest_meta -> 'versionLabel'
        )
      )
    ),
    'assets', v_assets
  );
end;
$$;

comment on function public.fetch_quest_review_data(uuid, text) is
  'Loads quest content for an external review. Callable with the anon key. Returns {valid:false} when the review id, token, in_progress status, or active flag does not match. Returns {error} when the quest is missing, inactive, or invisible. quest.template is project.template. Quest metadata keeps bible or fia plus versionLabel. Asset metadata keeps verse or pericope.';

revoke all on function public.fetch_quest_review_data(uuid, text) from public;
revoke all on function public.fetch_quest_review_data(uuid, text) from authenticated;
grant execute on function public.fetch_quest_review_data(uuid, text) to anon;
