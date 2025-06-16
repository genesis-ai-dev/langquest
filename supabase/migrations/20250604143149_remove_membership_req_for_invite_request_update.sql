drop policy "Users can update their own invitations" on "public"."invite_request";

create policy "Users can update their own invitations"
on "public"."invite_request"
as permissive
for update
to authenticated
using (((sender_profile_id = auth.uid()) OR (receiver_profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.project_id = invite_request.project_id) AND (ppl.profile_id = auth.uid()) AND (ppl.membership = 'owner'::text) AND (ppl.active = true))))))
with check (((sender_profile_id = auth.uid()) OR (receiver_profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.project_id = invite_request.project_id) AND (ppl.profile_id = auth.uid()) AND (ppl.membership = 'owner'::text) AND (ppl.active = true))))));



