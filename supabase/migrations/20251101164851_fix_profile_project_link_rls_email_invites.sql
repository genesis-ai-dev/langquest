-- Fix RLS policy to support email-based invites
-- When an invite is sent by email (receiver_profile_id is null),
-- users should be able to accept it by matching their email

-- Drop and recreate the insert policy to include email matching
drop policy if exists "Enable insert for valid project memberships only" on "public"."profile_project_link";

create policy "Enable insert for valid project memberships only"
on "public"."profile_project_link"
as permissive
for insert
to authenticated
with check (
  -- Case 1: User is creating their own project (creator gets owner access)
  (
    profile_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM public.project p 
      WHERE p.id = profile_project_link.project_id 
      AND p.creator_id = auth.uid()
    )
  )
  OR
  -- Case 2: User is accepting an invite (accepted invite for this user/project)
  -- Support both receiver_profile_id and email-based invites
  (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invite i
      WHERE i.project_id = profile_project_link.project_id
      AND i.status = 'accepted'
      AND i.active = true
      AND (
        -- Invite matched by profile ID
        i.receiver_profile_id = auth.uid()
        OR
        -- Invite matched by email (when receiver_profile_id is null)
        (
          i.receiver_profile_id IS NULL
          AND i.email = (SELECT email FROM public.profile WHERE id = auth.uid())
        )
      )
    )
  )
  OR
  -- Case 3: Project owner is accepting someone's request (accepted request for target user/project)
  (
    EXISTS (
      SELECT 1 FROM public.request r
      WHERE r.project_id = profile_project_link.project_id
      AND r.sender_profile_id = profile_project_link.profile_id
      AND r.status = 'accepted'
      AND r.active = true
    )
    AND EXISTS (
      SELECT 1 FROM public.profile_project_link ppl
      WHERE ppl.project_id = profile_project_link.project_id
      AND ppl.profile_id = auth.uid()
      AND ppl.membership = 'owner'
      AND ppl.active = true
    )
  )
);

-- Also update the update policy to support email-based invites for activation
drop policy if exists "Enable update for project owners and invite acceptance" on "public"."profile_project_link";

create policy "Enable update for project owners and invite acceptance"
on "public"."profile_project_link"
as permissive
for update
to authenticated
using (
  -- Case 1: User is a project owner (existing functionality)
  EXISTS (
    SELECT 1 FROM public.profile_project_link ppl
    WHERE ppl.project_id = profile_project_link.project_id
    AND ppl.profile_id = auth.uid()
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
  OR
  -- Case 2: User can only activate their own membership with accepted invite (SECURE)
  -- Support both receiver_profile_id and email-based invites
  (
    profile_project_link.profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invite i
      WHERE i.project_id = profile_project_link.project_id
      AND i.status = 'accepted'
      AND i.active = true
      AND (
        -- Invite matched by profile ID
        i.receiver_profile_id = auth.uid()
        OR
        -- Invite matched by email (when receiver_profile_id is null)
        (
          i.receiver_profile_id IS NULL
          AND i.email = (SELECT email FROM public.profile WHERE id = auth.uid())
        )
      )
    )
  )
  OR
  -- Case 3: Users can leave projects (deactivate their own membership)
  (
    profile_project_link.profile_id = auth.uid()
  )
)
with check (
  -- Case 1: Project owners can make any updates
  EXISTS (
    SELECT 1 FROM public.profile_project_link ppl
    WHERE ppl.project_id = profile_project_link.project_id
    AND ppl.profile_id = auth.uid()
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
  OR
  -- Case 2: Users can activate and set membership to what invite specifies
  -- Support both receiver_profile_id and email-based invites
  (
    profile_project_link.profile_id = auth.uid()
    AND profile_project_link.active = true
    AND EXISTS (
      SELECT 1 FROM public.invite i
      WHERE i.project_id = profile_project_link.project_id
      AND i.status = 'accepted'
      AND i.active = true
      AND (
        -- Invite matched by profile ID
        (
          i.receiver_profile_id = auth.uid()
          AND (
            (i.as_owner = true AND profile_project_link.membership = 'owner') OR
            (i.as_owner = false AND profile_project_link.membership = 'member')
          )
        )
        OR
        -- Invite matched by email (when receiver_profile_id is null)
        (
          i.receiver_profile_id IS NULL
          AND i.email = (SELECT email FROM public.profile WHERE id = auth.uid())
          AND (
            (i.as_owner = true AND profile_project_link.membership = 'owner') OR
            (i.as_owner = false AND profile_project_link.membership = 'member')
          )
        )
      )
    )
  )
  OR
  -- Case 3: Users can leave projects (deactivate AND demote to member)
  (
    profile_project_link.profile_id = auth.uid()
    AND profile_project_link.active = false
    AND profile_project_link.membership = 'member'
  )
);

