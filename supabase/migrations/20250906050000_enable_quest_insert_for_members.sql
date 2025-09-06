-- Enable quest inserts by project creator and active project members
-- Context: Mobile app failed to upsert quest with RLS 42501 during publish
-- Policy grants INSERT to authenticated users who are either:
--  - the creator of the target project, or
--  - an active member of the project (any membership level)

-- Safety: recreate idempotently
drop policy if exists "Enable quest insert for project members" on "public"."quest";

create policy "Enable quest insert for project members"
on "public"."quest"
as permissive
for insert
to authenticated
with check (
  exists (
    select 1
    from profile_project_link ppl
    where ppl.profile_id = auth.uid()
      and ppl.project_id = quest.project_id
      and coalesce(ppl.active, true) = true
  )
  or exists (
    select 1
    from project p
    where p.id = quest.project_id
      and p.creator_id = auth.uid()
  )
);


