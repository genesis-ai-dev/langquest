-- Path A: anon RPC to check external review link credentials only.
-- Same gates as fetch_quest_review_data (review token + quest active/visible).
-- No APP_SCHEMA_VERSION / get_schema_info() bump.

create or replace function public.validate_review_token(
  review_id uuid,
  token text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quest_id uuid;
begin
  select r.quest_id
    into v_quest_id
    from public.review r
   where r.id = review_id
     and r.access_token is not null
     and token is not null
     and token <> ''
     and r.access_token = token
     and r.status = 'in_progress'
     and r.active;

  if not found then
    return false;
  end if;

  return exists (
    select 1
      from public.quest q
     where q.id = v_quest_id
       and q.active is true
       and q.visible is true
  );
end;
$$;

comment on function public.validate_review_token(uuid, text) is
  'Returns true when review_id and token match an active in_progress external review and its quest is active and visible. Callable with the anon key.';

revoke all on function public.validate_review_token(uuid, text) from public;
revoke all on function public.validate_review_token(uuid, text) from authenticated;
grant execute on function public.validate_review_token(uuid, text) to anon;
