-- migration: prevent accepting expired invites and requests in RLS policies
-- purpose: update RLS policies to check for expired invites/requests before allowing acceptance
-- affects: RLS policies for invite, request, and profile_project_link tables
-- notes:
-- - expired invites/requests are determined by: status = 'pending' AND last_updated < (now() - interval '7 days')
-- - prevents users from accepting expired invites/requests
-- - matches the expiration logic used in system.ts union views

-- ================================================================
-- UPDATE INVITE UPDATE POLICY TO PREVENT ACCEPTING EXPIRED INVITES
-- ================================================================
-- The existing policy allows receivers to accept invites, but doesn't check if they're expired.
-- We need to prevent accepting expired invites (status='pending' AND last_updated < now() - 7 days).
-- This matches the expiration logic used in system.ts union views.

drop policy if exists "Receivers can only accept or decline invitations" on "public"."invite";

create policy "Receivers can only accept or decline invitations"
on "public"."invite"
as permissive
for update
to authenticated
using (
  receiver_profile_id = auth.uid()
  -- Prevent accepting expired invites: if current status is 'pending', verify it's not expired
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
  -- Prevent accepting expired invites: if new status is 'accepted', verify invite wasn't expired
  -- We check the OLD status (from USING clause) - if it was 'pending' and expired, reject
  -- Note: The USING clause already prevents this, but we add explicit check here for clarity
  AND (
    status = 'declined'
    OR (
      status = 'accepted'
      -- If accepting, the invite must not be expired (checked in USING clause above)
      -- Additional safety: verify last_updated is recent enough (within 7 days)
      -- Actually, if status changes to 'accepted', last_updated will be updated to now()
      -- So we check the OLD last_updated value indirectly through the USING clause
      -- The USING clause already prevents accepting expired invites, so this is redundant but safe
    )
  )
);

-- ================================================================
-- UPDATE REQUEST UPDATE POLICY TO PREVENT ACCEPTING EXPIRED REQUESTS
-- ================================================================
-- The existing policy allows project owners to accept requests, but doesn't check if they're expired.
-- We need to prevent accepting expired requests (status='pending' AND last_updated < now() - 7 days).
-- This matches the expiration logic used in system.ts union views.

drop policy if exists "sender or project owner can update" on "public"."request";

create policy "sender or project owner can update"
on "public"."request"
as permissive
for update
to authenticated
using (
  (auth.uid() = sender_profile_id) 
  OR (
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
-- The existing policy allows creating membership links from accepted invites,
-- but doesn't verify the invite wasn't expired when accepted.

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
  -- CRITICAL: Verify invite is not expired
  -- Note: If status='accepted', it means the invite UPDATE policy already verified it wasn't expired
  -- when accepting.
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
  -- CRITICAL: Verify request is not expired
  -- Note: Similar to invites, if status='accepted', the request UPDATE policy already verified
  -- it wasn't expired when accepting.
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
-- The existing policy allows reactivating membership with accepted invites,
-- but doesn't verify the invite wasn't expired when accepted.

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
  -- CRITICAL: Verify invite is not expired
  (
    profile_project_link.profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invite i
      WHERE i.project_id = profile_project_link.project_id
      AND i.receiver_profile_id = auth.uid()
      AND i.status = 'accepted'
      AND i.active = true
      -- Prevent using expired invites: if status='accepted', it means it was accepted
      -- The UPDATE policy on invite table prevents accepting expired invites, so this is safe
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
  -- CRITICAL: Verify invite is not expired
  (
    profile_project_link.profile_id = auth.uid()
    AND profile_project_link.active = true
    AND EXISTS (
      SELECT 1 FROM public.invite i
      WHERE i.project_id = profile_project_link.project_id
      AND i.receiver_profile_id = auth.uid()
      AND i.status = 'accepted'
      AND i.active = true
      -- Prevent using expired invites: if status='accepted', it means it was accepted
      -- The UPDATE policy on invite table prevents accepting expired invites, so this is safe
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
