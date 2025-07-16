drop trigger if exists "init_project_closure_trigger" on "public"."project";

drop trigger if exists "init_quest_closure_trigger" on "public"."quest";

drop trigger if exists "update_quest_closure_on_asset_link_trigger" on "public"."quest_asset_link";

drop trigger if exists "update_project_closure_on_quest_closure_trigger" on "public"."quest_closure";

drop trigger if exists "trigger_copy_asset_download_profiles" on "public"."translation";

drop trigger if exists "update_quest_closure_on_translation_trigger" on "public"."translation";

drop trigger if exists "trigger_copy_asset_download_profiles_to_vote" on "public"."vote";

drop trigger if exists "update_quest_closure_on_vote_trigger" on "public"."vote";

revoke delete on table "public"."project_closure" from "anon";

revoke insert on table "public"."project_closure" from "anon";

revoke references on table "public"."project_closure" from "anon";

revoke select on table "public"."project_closure" from "anon";

revoke trigger on table "public"."project_closure" from "anon";

revoke truncate on table "public"."project_closure" from "anon";

revoke update on table "public"."project_closure" from "anon";

revoke delete on table "public"."project_closure" from "authenticated";

revoke insert on table "public"."project_closure" from "authenticated";

revoke references on table "public"."project_closure" from "authenticated";

revoke select on table "public"."project_closure" from "authenticated";

revoke trigger on table "public"."project_closure" from "authenticated";

revoke truncate on table "public"."project_closure" from "authenticated";

revoke update on table "public"."project_closure" from "authenticated";

revoke delete on table "public"."project_closure" from "service_role";

revoke insert on table "public"."project_closure" from "service_role";

revoke references on table "public"."project_closure" from "service_role";

revoke select on table "public"."project_closure" from "service_role";

revoke trigger on table "public"."project_closure" from "service_role";

revoke truncate on table "public"."project_closure" from "service_role";

revoke update on table "public"."project_closure" from "service_role";

revoke delete on table "public"."quest_closure" from "anon";

revoke insert on table "public"."quest_closure" from "anon";

revoke references on table "public"."quest_closure" from "anon";

revoke select on table "public"."quest_closure" from "anon";

revoke trigger on table "public"."quest_closure" from "anon";

revoke truncate on table "public"."quest_closure" from "anon";

revoke update on table "public"."quest_closure" from "anon";

revoke delete on table "public"."quest_closure" from "authenticated";

revoke insert on table "public"."quest_closure" from "authenticated";

revoke references on table "public"."quest_closure" from "authenticated";

revoke select on table "public"."quest_closure" from "authenticated";

revoke trigger on table "public"."quest_closure" from "authenticated";

revoke truncate on table "public"."quest_closure" from "authenticated";

revoke update on table "public"."quest_closure" from "authenticated";

revoke delete on table "public"."quest_closure" from "service_role";

revoke insert on table "public"."quest_closure" from "service_role";

revoke references on table "public"."quest_closure" from "service_role";

revoke select on table "public"."quest_closure" from "service_role";

revoke trigger on table "public"."quest_closure" from "service_role";

revoke truncate on table "public"."quest_closure" from "service_role";

revoke update on table "public"."quest_closure" from "service_role";

alter table "public"."project_closure" drop constraint "project_closure_project_id_fkey";

alter table "public"."quest_closure" drop constraint "quest_closure_project_id_fkey";

alter table "public"."quest_closure" drop constraint "quest_closure_quest_id_fkey";

drop materialized view if exists "public"."asset_tag_categories";

drop function if exists "public"."copy_asset_download_profiles"();

drop function if exists "public"."copy_asset_download_profiles_to_vote"();

drop function if exists "public"."create_missing_project_closures"();

drop function if exists "public"."create_missing_quest_closures"();

drop function if exists "public"."download_project_closure"(project_id_param uuid, profile_id_param uuid);

drop function if exists "public"."download_quest_closure"(quest_id_param uuid, profile_id_param uuid);

drop function if exists "public"."init_project_closure"();

drop function if exists "public"."init_quest_closure"();

drop materialized view if exists "public"."quest_tag_categories";

drop function if exists "public"."rebuild_all_project_closures"();

drop function if exists "public"."rebuild_all_quest_closures"();

drop function if exists "public"."rebuild_single_project_closure"(project_id_param uuid);

drop function if exists "public"."rebuild_single_quest_closure"(quest_id_param uuid);

drop function if exists "public"."refresh_asset_tag_categories"();

drop function if exists "public"."refresh_quest_tag_categories"();

drop function if exists "public"."update_project_closure_on_quest_closure"();

drop function if exists "public"."update_quest_closure_on_asset_link"();

drop function if exists "public"."update_quest_closure_on_translation"();

drop function if exists "public"."update_quest_closure_on_vote"();

alter table "public"."project_closure" drop constraint "project_closure_pkey";

alter table "public"."quest_closure" drop constraint "quest_closure_pkey";

drop index if exists "public"."project_closure_last_updated_idx";

drop index if exists "public"."project_closure_pkey";

drop index if exists "public"."quest_closure_last_updated_idx";

drop index if exists "public"."quest_closure_pkey";

drop index if exists "public"."quest_closure_project_id_idx";

drop table "public"."project_closure";

drop table "public"."quest_closure";

alter table "public"."asset" alter column "images" set data type text using "images"::text;

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



