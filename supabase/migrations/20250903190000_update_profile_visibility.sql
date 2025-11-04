-- ================================================================
-- PROFILE VISIBILITY FOR PROJECT CO-MEMBERS
-- ================================================================
-- Purpose: Allow authenticated users to select profiles of users who share at
-- least one active project with them (owner or member), while still allowing
-- users to read their own profile. Enables membership UIs to display usernames
-- of fellow project members.

-- Replace self-only profile select policy with co-member visibility
drop policy if exists "Users can read own profile" on "public"."profile";
drop policy if exists "Project co-members can view profiles" on "public"."profile";

create policy "Project co-members can view profiles"
on "public"."profile"
as permissive
for select
to authenticated
using (
  -- Always allow users to read their own profile
  auth.uid() = id
  OR
  -- Allow reading profiles of users who share an active project
  EXISTS (
    SELECT 1
    FROM public.profile_project_link ppl_self
    JOIN public.profile_project_link ppl_other
      ON ppl_other.project_id = ppl_self.project_id
     AND ppl_other.profile_id = public.profile.id
     AND ppl_other.active = true
    WHERE ppl_self.profile_id = auth.uid()
      AND ppl_self.active = true
  )
);

