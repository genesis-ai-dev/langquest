-- Drop policy if it exists to ensure idempotency
drop policy if exists "project members can read requesting user profile"
  on public.profile;
-- Allow authenticated users to read the profile of users who have sent
-- pending requests to projects the current user is linked to
create policy "project members can read requesting user profile"
  on public.profile
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.request r
      where r.sender_profile_id = profile.id
        and r.status = 'pending'
        and exists (
          select 1
          from public.profile_project_link ppl
          where ppl.project_id = r.project_id
            and ppl.profile_id = auth.uid()
        )
    )
  );
  
-- Drop policy if it exists to ensure idempotency
drop policy if exists "invited users can read inviter profile"
  on public.profile;
-- Allow authenticated invited users to read inviter profiles
create policy "invited users can read inviter profile"
  on public.profile
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.invite i
      where i.sender_profile_id = profile.id
        and i.receiver_profile_id = auth.uid()
        and i.active = true
        and i.status in ('pending', 'accepted')
    )
  );