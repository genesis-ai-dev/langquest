alter table "public"."quest_asset_link" add column "visible" boolean not null default true;

create policy "Enable asset updates only by project owners"
on "public"."asset"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM ((quest_asset_link qal
     JOIN quest q ON ((q.id = qal.quest_id)))
     JOIN profile_project_link ppl ON ((ppl.project_id = q.project_id)))
  WHERE ((qal.asset_id = asset.id) AND (ppl.profile_id = auth.uid()) AND (ppl.membership = 'owner'::text)))));


create policy "Enable quest updates only for project owners"
on "public"."quest"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.profile_id = auth.uid()) AND (ppl.project_id = quest.project_id) AND (ppl.membership = 'owner'::text)))));


create policy "Enable updates only for project owners"
on "public"."quest_asset_link"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM (quest q
     JOIN profile_project_link ppl ON ((ppl.project_id = q.project_id)))
  WHERE ((q.id = quest_asset_link.quest_id) AND (ppl.profile_id = auth.uid()) AND (ppl.membership = 'owner'::text)))));



