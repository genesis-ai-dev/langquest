-- migration: create rpc to upsert project ownership link
-- purpose: provides a safe, auditable entry-point for the frontend to establish
--          project ownership by upserting an owner link in public.profile_project_link.
--          this function asserts the caller can only grant ownership to themselves.
-- affected objects:
--   - function public.create_project_ownership(uuid, uuid)
--   - policies on public.profile_project_link (read-own safeguard)
-- notes:
--   - security definer is used intentionally so inserts can bypass rls on
--     public.profile_project_link while still validating the caller via auth.uid().
--   - search_path is set to '' and all objects are fully qualified for safety.

-- create or replace the rpc used by the app to create/upsert ownership link
create or replace function public.create_project_ownership(
  p_project_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- ensure the caller can only grant ownership to themselves
  if p_profile_id is distinct from auth.uid() then
    raise exception 'profile_id must equal the authenticated user id';
  end if;

  insert into public.profile_project_link (profile_id, project_id, membership, active)
  values (p_profile_id, p_project_id, 'owner', true)
  on conflict (profile_id, project_id) do update
    set membership = 'owner',
        active = true;
end;
$$;

-- allow authenticated users to call the function
grant execute on function public.create_project_ownership(uuid, uuid) to authenticated;

-- optional: if a read-own policy does not already exist, create one
-- this enables clients to query their own membership links when needed
create policy if not exists "read own links"
on public.profile_project_link
for select
to authenticated
using (profile_id = auth.uid());


