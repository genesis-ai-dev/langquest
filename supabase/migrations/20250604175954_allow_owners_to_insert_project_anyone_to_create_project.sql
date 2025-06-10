create policy "Authenticated users can create projects"
on "public"."project"
as permissive
for insert
to authenticated
with check ((creator_id = auth.uid()));


create policy "Project owners can update their projects"
on "public"."project"
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.project_id = project.id) AND (ppl.profile_id = auth.uid()) AND (ppl.membership = 'owner'::text) AND (ppl.active = true)))))
with check ((EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.project_id = project.id) AND (ppl.profile_id = auth.uid()) AND (ppl.membership = 'owner'::text) AND (ppl.active = true)))));



