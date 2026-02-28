-- ============================================================================
-- RLS POLICY
-- ============================================================================

-- Drop policy if it exists to ensure idempotency
drop policy if exists "project members can read requesting user profile"
  on public.profile;

-- Allow authenticated users to read the profile of users who have sent
-- requests to projects the current user is linked to
-- Rationale: A profile should only be visible to authenticated users
-- when there is a legitimate relationship established via a request
-- tied to one of their projects. This prevents unrestricted profile
-- access while enabling necessary visibility within project context.
create policy "project members can read requesting user profile"
  on public.profile
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.request r
      where r.sender_profile_id = profile.id
        and exists (
          select 1
          from public.profile_project_link ppl
          where ppl.project_id = r.project_id
            and ppl.profile_id = auth.uid()
        )
    )
  );