-- ============================================================================
-- Allow project owners and members to publish quests they didn't create
-- ============================================================================
-- This migration updates the quest insert RLS policy to allow owners/members
-- to publish quests within their project, even if they're not the creator.
-- This enables collaborative publishing workflows where team members can
-- publish content created by others in their project.
--
-- SECURITY: Still requires project membership (owner/member) via profile_project_link
-- or project creator status. The original creator_id is preserved when publishing.
-- ============================================================================

-- Drop the existing restrictive policy
drop policy if exists "Quest insert limited to owners and members" on public.quest;

-- Create updated policy that allows owners/members to publish quests they didn't create
-- The policy allows inserts if:
-- 1. User is an owner/member of the project (via profile_project_link), OR
-- 2. User is the project creator (if no profile_project_link exists yet)
--
-- Note: The quest.creator_id can be different from auth.uid() - we preserve
-- the original creator when publishing, but allow owners/members to publish it.
create policy "Quest insert limited to owners and members"
on public.quest
as permissive
for insert
to authenticated
with check (
  (
    exists (
      select 1
      from profile_project_link ppl
      where ppl.profile_id = (select auth.uid())
        and ppl.project_id = quest.project_id
        and ppl.membership in ('owner', 'member')
        and ppl.active = true
    )
    or (
      not exists (
        select 1
        from profile_project_link ppl2
        where ppl2.profile_id = (select auth.uid())
          and ppl2.project_id = quest.project_id
          and ppl2.active = true
      )
      and exists (
        select 1
        from project p
        where p.id = quest.project_id
          and p.creator_id = (select auth.uid())
      )
    )
  )
  -- REMOVED: and quest.creator_id = (select auth.uid())
  -- This constraint prevented owners/members from publishing quests created by others.
  -- We now allow publishing if user has project membership, regardless of creator_id.
);

