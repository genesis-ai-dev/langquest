-- Migration: Add quest_asset_link creation to v0_to_v1 translation transform
-- Purpose: Ensure that when legacy public.translation records are transformed via v0_to_v1,
--          we also create quest_asset_link rows linking the new variant asset to all quests
--          that referenced the parent (source) asset, mirroring the logic used in
--          20251008120001_modernize_schema_structure.sql (Step 3).
-- Affected objects: public.v0_to_v1 (function)
-- Special considerations: Function is used by the mutation orchestrator; we preserve
--                         existing behavior (asset + asset_content_link) and add quest_asset_link ops.

create or replace function public.v0_to_v1(
  p_ops public.mutation_op[],
  p_meta jsonb
)
returns public.mutation_op[]
language plpgsql
as $$
declare
  out_ops public.mutation_op[] := '{}';
  op public.mutation_op;
  new_ops public.mutation_op[] := '{}';
  v_meta text := coalesce(p_meta->>'metadata', '');
  v_version_is_v0 boolean := (v_meta = '0') or (v_meta like '0.%');
  v_id uuid;
  v_parent_id uuid;
  v_acl_id uuid;
  v_active bool;
  v_qal_quest_id uuid;
  v_qal_visible boolean;
begin
  raise log '[v0_to_v1] start meta=% is_v0=% ops_count=%',
    v_meta,
    v_version_is_v0,
    coalesce(array_length(p_ops,1),0);

  foreach op in array p_ops loop
    raise log '[v0_to_v1] inbound op: table=% op=% record=%',
      op.table_name, op.op, op.record::text;

    if v_version_is_v0 and lower(op.table_name) = 'translation' then
      -- Gather IDs / derived fields
      begin v_id := (op.record->>'id')::uuid; exception when others then v_id := gen_random_uuid(); end;
      begin v_parent_id := (op.record->>'asset_id')::uuid; exception when others then v_parent_id := null; end;
      v_acl_id := gen_random_uuid();
      v_active := coalesce((op.record->>'active')::boolean, true);

      raise log '[v0_to_v1] translation map: new_variant_asset_id=% parent_asset_id=% acl_id=% active=%',
        v_id, v_parent_id, v_acl_id, v_active;

      -- 1) asset (variant row)
      new_ops := new_ops || (row(
        'asset',
        case when lower(op.op) = 'delete' then 'delete' else 'put' end,
        jsonb_build_object(
          'id', v_id,
          'source_asset_id', v_parent_id,
          'active', v_active,
          'visible', coalesce((op.record->>'visible')::boolean, true),
          'creator_id', (op.record->>'creator_id')::uuid,
          'download_profiles', coalesce(op.record->'download_profiles', '[]'::jsonb),
          'created_at', op.record->>'created_at',
          'last_updated', op.record->>'last_updated'
        )
      ))::public.mutation_op;

      -- 2) asset_content_link (text, lang binding) for put/patch
      if lower(op.op) in ('put','patch','update') then
        new_ops := new_ops || (row(
          'asset_content_link',
          'put',
          (
            (op.record - 'target_language_id' - 'asset_id' - 'creator_id' - 'visible')
            || jsonb_build_object(
                'id', v_acl_id::text,
                'asset_id', v_id::text,
                'source_language_id', op.record->>'target_language_id'
              )
          )
        ))::public.mutation_op;
      end if;

      -- 3) quest_asset_link for each quest that currently links the parent asset
      -- Mirrors logic in 20251008120001_modernize_schema_structure.sql Step 3
      for v_qal_quest_id, v_qal_visible in
        select qal.quest_id, qal.visible
        from public.quest_asset_link qal
        where qal.asset_id = v_parent_id and qal.active = true
      loop
        new_ops := new_ops || (row(
          'quest_asset_link',
          'put',
          jsonb_build_object(
            'quest_id', v_qal_quest_id::text,
            'asset_id', v_id::text,
            'active', v_active,
            'created_at', op.record->>'created_at',
            'last_updated', op.record->>'last_updated',
            'visible', v_qal_visible,
            'download_profiles', coalesce(op.record->'download_profiles', '[]'::jsonb)
          )
        ))::public.mutation_op;
      end loop;

      raise log '[v0_to_v1] translation produced % ops',
        coalesce(array_length(new_ops,1),0);

      out_ops := out_ops || new_ops;
      new_ops := '{}';

    elsif v_version_is_v0 and lower(op.table_name) = 'vote' then
      -- Legacy vote -> asset_vote mapping (unchanged)
      declare v_vote_id uuid; begin v_vote_id := (op.record->>'id')::uuid; exception when others then v_vote_id := gen_random_uuid(); end;
      raise log '[v0_to_v1] vote map: vote_id=% translation_id=%',
        v_vote_id,
        op.record->>'translation_id';

      new_ops := new_ops || (
        with
        t as (
          select id, asset_id
          from public.translation
          where id = (op.record->>'translation_id')::uuid
        ),
        a_variant as (
          select a.id
          from public.asset a
          join t on a.id = t.id
        )
        select (row(
          'asset_vote',
          case when lower(op.op) = 'delete' then 'delete' else 'put' end,
          (
            op.record
            || jsonb_build_object(
                 'asset_id', coalesce(
                                (select id from a_variant),
                                (select asset_id from t)
                              )::text
               )
            - 'translation_id'
          )
        ))::public.mutation_op
      );

      raise log '[v0_to_v1] vote produced % ops',
        coalesce(array_length(new_ops,1),0);

      out_ops := out_ops || new_ops;
      new_ops := '{}';

    else
      -- passthrough
      out_ops := out_ops || op;
    end if;
  end loop;

  raise log '[v0_to_v1] end out_ops_count=%', coalesce(array_length(out_ops,1),0);

  return out_ops;
end;
$$;

-- Also add a BEFORE INSERT trigger on quest_asset_link to copy download_profiles
-- from the linked quest into the new qal row (mirrors style used for asset and ACL).

create or replace function public.copy_quest_download_profiles_to_qal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Copy quest.download_profiles into the new quest_asset_link row
  select q.download_profiles
  into new.download_profiles
  from public.quest q
  where q.id = new.quest_id;

  return new;
end;
$$;

drop trigger if exists trg_copy_quest_download_profiles_on_qal on public.quest_asset_link;
create trigger trg_copy_quest_download_profiles_on_qal
before insert on public.quest_asset_link
for each row
execute function public.copy_quest_download_profiles_to_qal();


