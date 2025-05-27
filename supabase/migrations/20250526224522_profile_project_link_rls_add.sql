create policy "Enable insert for authenticated users only"
on "public"."profile_project_link"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for all users"
on "public"."profile_project_link"
as permissive
for select
to public
using (true);


create policy "Enable update for members and owners"
on "public"."profile_project_link"
as permissive
for update
to authenticated
using (((profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.project_id = profile_project_link.project_id) AND (ppl.profile_id = auth.uid()) AND (ppl.membership = 'owner'::text) AND (ppl.active = true))))))
with check (((profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.project_id = profile_project_link.project_id) AND (ppl.profile_id = auth.uid()) AND (ppl.membership = 'owner'::text) AND (ppl.active = true))))));



