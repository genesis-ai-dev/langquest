-- ================================================================
-- COMPREHENSIVE RLS SECURITY HARDENING MIGRATION
-- ================================================================
-- 
-- This migration addresses multiple critical security vulnerabilities in RLS policies:
--
-- CRITICAL FIXES:
-- 1. Privilege Escalation: Users could promote themselves to project owners
-- 2. Vote Manipulation: Any user could modify any vote in the system  
-- 3. Impersonation Attacks: Users could create content attributed to other users
-- 4. Missing Policies: Some tables had RLS enabled but no policies (inaccessible)
-- 5. Role Scope Issues: Some policies used 'public' instead of 'authenticated'
--
-- SECURITY PRINCIPLES APPLIED:
-- - Principle of least privilege: Only necessary permissions granted
-- - Creator ownership: Users can only modify content they created
-- - Project ownership: Only project owners can modify project-scoped content
-- - Authenticated-only access: Sensitive operations restricted to logged-in users
-- ================================================================

drop policy "Enable ALL for users by id" on "public"."asset";

drop policy "Enable ALL for users by id" on "public"."asset_content_link";

drop policy "Enable ALL for users by id" on "public"."asset_tag_link";

drop policy "Enable ALL for users by id" on "public"."project";

drop policy "Enable ALL for users by id" on "public"."quest";

drop policy "Enable ALL for users by id" on "public"."quest_asset_link";

drop policy "Enable ALL for users by id" on "public"."quest_tag_link";

drop policy "Enable ALL for users by id" on "public"."tag";

alter table "public"."project_closure" enable row level security;

create policy "Enable read access for all users"
on "public"."project_closure"
as PERMISSIVE
for SELECT
to public
using (
  true
);

alter table "public"."quest_closure" enable row level security;

create policy "Enable read access for all users"
on "public"."quest_closure"
as PERMISSIVE
for SELECT
to public
using (
  true
);

-- ================================================================
-- SECTION 3: FIX PROFILE_PROJECT_LINK POLICIES (CRITICAL)
-- ================================================================
-- These policies control project membership and had serious security flaws.

-- Replace overly permissive profile_project_link insert policy
-- OLD ISSUE: Any authenticated user could create any membership link
-- NEW SECURITY: Only allows legitimate membership creation through proper flows
drop policy "Enable insert for authenticated users only" on "public"."profile_project_link";

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

-- Replace overly permissive profile_project_link update policy
-- SECURITY FIX: The old policy allowed users to update their own membership records,
-- creating a privilege escalation vulnerability where regular members could promote 
-- themselves to 'owner' by updating their own profile_project_link.membership field.
-- The new policy restricts updates to project owners only.
drop policy "Enable update for members and owners" on "public"."profile_project_link";

create policy "Enable update for project owners only"
on "public"."profile_project_link"
as permissive
for update
to authenticated
using (
  EXISTS (
    SELECT 1 FROM public.profile_project_link ppl
    WHERE ppl.project_id = profile_project_link.project_id
    AND ppl.profile_id = auth.uid()
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
)
with check (
  EXISTS (
    SELECT 1 FROM public.profile_project_link ppl
    WHERE ppl.project_id = profile_project_link.project_id
    AND ppl.profile_id = auth.uid()
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
);

-- ================================================================
-- SECTION 4: FIX CONTENT MODIFICATION POLICIES  
-- ================================================================
-- Restrict content updates to appropriate roles and authenticated users only.

-- Update asset policy to restrict to authenticated users only
-- IMPROVEMENT: Changed from 'to public' to 'to authenticated' for better security
drop policy "Enable asset updates only by project owners" on "public"."asset";

create policy "Enable asset updates only by project owners"
on "public"."asset"
as permissive
for update
to authenticated
using (
  EXISTS (
    SELECT 1
    FROM quest_asset_link qal
    JOIN quest q ON (q.id = qal.quest_id)
    JOIN profile_project_link ppl ON (ppl.project_id = q.project_id)
    WHERE qal.asset_id = asset.id
    AND ppl.profile_id = auth.uid()
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
);

-- Update translation policy to restrict to authenticated users only  
-- IMPROVEMENT: Changed from 'to public' to 'to authenticated' for better security
drop policy "Enable translation updates only by translation creator" on "public"."translation";

create policy "Enable translation updates only by translation creator"
on "public"."translation"
as permissive
for update
to authenticated
using (
  creator_id = auth.uid()
);

-- ================================================================
-- SECTION 5: FIX USER-GENERATED CONTENT POLICIES (CRITICAL)
-- ================================================================  
-- Prevent impersonation attacks by enforcing creator ownership.

-- Replace overly permissive translation insert policy
-- SECURITY FIX: Prevents users from creating translations attributed to other users
drop policy "Enable insert for authenticated users only" on "public"."translation";

create policy "Enable translation insert only by creator"
on "public"."translation"
as permissive
for insert
to authenticated
with check (
  creator_id = auth.uid()
);

-- Replace overly permissive reports insert policy  
-- SECURITY FIX: Prevents users from creating reports on behalf of other users
drop policy "Enable insert for authenticated users only" on "public"."reports";

create policy "Enable report insert only by reporter"
on "public"."reports"
as permissive
for insert
to authenticated
with check (
  reporter_id = auth.uid()
);

-- Replace overly permissive vote insert policy
-- SECURITY FIX: Prevents users from voting on behalf of other users  
drop policy "Enable insert for authenticated users only" on "public"."vote";

create policy "Enable vote insert only by creator"
on "public"."vote"
as permissive
for insert
to authenticated
with check (
  creator_id = auth.uid()
);

-- ================================================================
-- SECTION 6: FIX VOTING SYSTEM VULNERABILITIES (CRITICAL)
-- ================================================================
-- The voting system had massive security holes allowing vote manipulation.

-- Fix CRITICAL vote update vulnerability
-- SECURITY FIX: Old policy allowed ANY user to update ANY vote - massive security hole
drop policy "Enable update for authenticated users only" on "public"."vote";

create policy "Enable vote update only by vote creator"
on "public"."vote"
as permissive
for update
to authenticated
using (
  creator_id = auth.uid()
)
with check (
  creator_id = auth.uid()
);

-- ================================================================
-- SECTION 7: FIX QUEST MANAGEMENT POLICIES
-- ================================================================
-- Quest policies had incorrect role assignments and needed authentication restrictions.

-- Fix quest-related policies to restrict to authenticated users only
-- IMPROVEMENT: Changed from 'to public' to 'to authenticated' for security
drop policy "Enable quest updates only for project owners" on "public"."quest";

create policy "Enable quest updates only for project owners"
on "public"."quest"
as permissive
for update
to authenticated
using (
  EXISTS (
    SELECT 1 FROM profile_project_link ppl
    WHERE ppl.profile_id = auth.uid()
    AND ppl.project_id = quest.project_id
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
);

drop policy "Enable updates only for project owners" on "public"."quest_asset_link";

create policy "Enable updates only for project owners"
on "public"."quest_asset_link"
as permissive
for update
to authenticated
using (
  EXISTS (
    SELECT 1
    FROM quest q
    JOIN profile_project_link ppl ON (ppl.project_id = q.project_id)
    WHERE q.id = quest_asset_link.quest_id
    AND ppl.profile_id = auth.uid()
    AND ppl.membership = 'owner'
    AND ppl.active = true
  )
);

-- ================================================================
-- SECTION 8: ADD MISSING POLICIES FOR CORE TABLES (CRITICAL)
-- ================================================================
-- These tables had RLS enabled but no policies, making them completely unusable.

-- Add missing RLS policies for notification table
-- CRITICAL FIX: Table had RLS enabled but no policies, making it completely inaccessible
create policy "Users can view their own notifications"
on "public"."notification"
as permissive
for select
to authenticated
using (
  profile_id = auth.uid()
);

create policy "Users can update their own notifications"
on "public"."notification"
as permissive
for update
to authenticated
using (
  profile_id = auth.uid()
)
with check (
  profile_id = auth.uid()
);

-- Add missing RLS policies for subscription table  
-- CRITICAL FIX: Table had RLS enabled but no policies, making it completely inaccessible
create policy "Users can manage their own subscriptions"
on "public"."subscription"
as permissive
for all
to authenticated
using (
  profile_id = auth.uid()
)
with check (
  profile_id = auth.uid()
);

-- Replace multiple granular policies with efficient 'for all' policies.
drop policy if exists "Users can create their own content blocks" on "public"."blocked_content";
drop policy if exists "Users can delete their own content blocks" on "public"."blocked_content";
drop policy if exists "Users can update their own content blocks" on "public"."blocked_content";
drop policy if exists "Users can view their own blocked content" on "public"."blocked_content";

drop policy if exists "Users can create their own blocks" on "public"."blocked_users";
drop policy if exists "Users can delete their own blocks" on "public"."blocked_users";
drop policy if exists "Users can update their own blocks" on "public"."blocked_users";
drop policy if exists "Users can view their own blocked users" on "public"."blocked_users";

create policy "All actions allowed for own blocked content"
on public.blocked_content
for all
to authenticated
with check (
  (auth.uid() = profile_id)
);

create policy "All actions allowed for own blocked users"
on public.blocked_users
for all
to authenticated
with check (
  (auth.uid() = blocker_id)
);

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
-- Summary of security improvements:
-- ✅ Fixed privilege escalation in project memberships
-- ✅ Fixed vote manipulation vulnerabilities  
-- ✅ Prevented impersonation attacks in user-generated content
-- ✅ Added missing policies for notification/subscription tables
-- ✅ Restricted sensitive operations to authenticated users only
-- ✅ Consolidated blocking policies for better performance
-- 
-- All policies now follow security best practices and principle of least privilege.
-- ================================================================

