-- migration: prevent accepting expired invites and requests in RLS policies
-- purpose: update RLS policies to check for expired invites/requests before allowing acceptance
-- affects: RLS policies for invite, request, and profile_project_link tables
-- notes:
-- - expired invites/requests are determined by: status = 'pending' AND last_updated < (now() - interval '7 days')
-- - prevents users from accepting expired invites/requests
-- - matches the expiration logic used in system.ts union views

-- ================================================================
-- UPDATE INVITE UPDATE POLICY TO PREVENT UPDATING EXPIRED INVITES
-- ================================================================
-- Prevent receivers from updating expired invites (any update, including accepting or declining).
-- Expired invites: status='pending' AND last_updated < (now() - interval '7 days')
-- Note: Expired invites still have 'pending' status on the server (intentional).

drop policy if exists "Receivers can only accept or decline invitations" on "public"."invite";

create policy "Receivers can only accept or decline invitations"
on "public"."invite"
as permissive
for update
to authenticated
using (
  receiver_profile_id = auth.uid()
  -- Prevent ANY update when invite is expired (including accepting or declining)
  -- Expired invites: status='pending' AND last_updated < (now() - interval '7 days')
  AND NOT (
    status = 'pending'
    AND last_updated < (now() - interval '7 days')
    AND active = true
  )
)
with check (
  receiver_profile_id = auth.uid()
  AND status IN ('accepted', 'declined')
);

-- ================================================================
-- UPDATE REQUEST UPDATE POLICY TO PREVENT ACCEPTING EXPIRED REQUESTS
-- ================================================================
-- For testing: Only allow project owners to accept requests, and prevent accepting expired ones.
-- Expired requests: status='pending' AND last_updated < (now() - interval '7 days')

drop policy if exists "sender or project owner can update" on "public"."request";

create policy "sender or project owner can update"
on "public"."request"
as permissive
for update
to authenticated
using (
  -- Case 1: Senders can update their own requests
  (auth.uid() = sender_profile_id)
  OR
  -- Case 2: Project owners can accept requests (but not expired ones)
  (
    EXISTS (
      SELECT 1 FROM profile_project_link ppl
      WHERE ppl.project_id = request.project_id
      AND ppl.profile_id = auth.uid()
      AND ppl.active = true
      AND ppl.membership = 'owner'
    )
    -- Prevent accepting expired requests: if current status is 'pending', verify it's not expired
    -- Expired requests: status='pending' AND last_updated < (now() - interval '7 days')
    AND NOT (
      status = 'pending'
      AND last_updated < (now() - interval '7 days')
      AND active = true
    )
  )
);

-- ================================================================
-- UPDATE PROFILE_PROJECT_LINK INSERT POLICY TO PREVENT USING EXPIRED INVITES
-- ================================================================
-- For testing: Only allow inserting membership links from accepted invites.
-- The invite UPDATE policy already prevents accepting expired invites.

drop policy if exists "Enable insert for valid project memberships only" on "public"."profile_project_link";

create policy "Enable insert for valid project memberships only"
on "public"."profile_project_link"
as permissive
for insert
to authenticated
with check (
  -- Case 1: User is creating their own project (creator gets owner access)
  -- BUT: Prevent if there's an expired invite for this user/project (can't bypass expired invite check)
  (
    profile_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM public.project p 
      WHERE p.id = profile_project_link.project_id 
      AND p.creator_id = auth.uid()
    )
    -- Prevent inserting if there's an expired invite for this user/project
    -- This ensures creators can't bypass expired invite checks
    AND NOT EXISTS (
      SELECT 1 FROM public.invite i
      WHERE i.project_id = profile_project_link.project_id
      AND i.receiver_profile_id = auth.uid()
      AND i.status = 'pending'
      AND i.last_updated < (now() - interval '7 days')
      AND i.active = true
    )
  )
  OR
  -- Case 2: User is accepting an invite (accepted invite for this user/project)
  (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invite i
      WHERE i.project_id = profile_project_link.project_id
      AND i.receiver_profile_id = auth.uid()
      AND i.status = 'accepted'
      AND i.active = true
    )
  )
  OR
  -- Case 3: Project owner is accepting someone's request (accepted request for target user/project)
  -- Note: The request UPDATE policy already prevents accepting expired requests
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

-- ================================================================
-- UPDATE PROFILE_PROJECT_LINK UPDATE POLICY TO PREVENT USING EXPIRED INVITES
-- ================================================================
-- For testing: Only allow updating membership with accepted invites.
-- The invite UPDATE policy already prevents accepting expired invites.

drop policy if exists "Enable update for project owners and invite acceptance" on "public"."profile_project_link";

create policy "Enable update for project owners and invite acceptance"
on "public"."profile_project_link"
as permissive
for update
to authenticated
using (
  -- Case 1: User is a project owner (can update any membership)
  EXISTS (
    SELECT 1 FROM public.profile_project_link ppl
    WHERE ppl.project_id = profile_project_link.project_id
    AND ppl.profile_id = auth.uid()
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
  OR
  -- Case 2: User can only activate their own membership with accepted invite
  (
    profile_project_link.profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invite i
      WHERE i.project_id = profile_project_link.project_id
      AND i.receiver_profile_id = auth.uid()
      AND i.status = 'accepted'
      AND i.active = true
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
  (
    profile_project_link.profile_id = auth.uid()
    AND profile_project_link.active = true
    AND EXISTS (
      SELECT 1 FROM public.invite i
      WHERE i.project_id = profile_project_link.project_id
      AND i.receiver_profile_id = auth.uid()
      AND i.status = 'accepted'
      AND i.active = true
      -- Allow membership to be updated to match invite
      AND (
        (i.as_owner = true AND profile_project_link.membership = 'owner') OR
        (i.as_owner = false AND profile_project_link.membership = 'member')
      )
    )
  )
  OR
  -- Case 3: Users can leave projects (deactivate AND demote to member)
  (
    profile_project_link.profile_id = auth.uid()
    AND profile_project_link.active = false  -- Can only deactivate (leave project)
    AND profile_project_link.membership = 'member'  -- DEMOTE TO MEMBER ON LEAVE
  )
);
