drop trigger if exists "before_invite_request_set_receiver" on "public"."invite_request";

drop trigger if exists "on_invite_request_awaiting_trigger" on "public"."invite_request";

drop trigger if exists "on_profile_created_link_invites" on "public"."profile";

drop policy "Project members can view project invitations" on "public"."invite_request";

drop policy "Project owners can create invitations" on "public"."invite_request";

drop policy "Users can update their own invitations" on "public"."invite_request";

revoke delete on table "public"."invite_request" from "anon";

revoke insert on table "public"."invite_request" from "anon";

revoke references on table "public"."invite_request" from "anon";

revoke select on table "public"."invite_request" from "anon";

revoke trigger on table "public"."invite_request" from "anon";

revoke truncate on table "public"."invite_request" from "anon";

revoke update on table "public"."invite_request" from "anon";

revoke delete on table "public"."invite_request" from "authenticated";

revoke insert on table "public"."invite_request" from "authenticated";

revoke references on table "public"."invite_request" from "authenticated";

revoke select on table "public"."invite_request" from "authenticated";

revoke trigger on table "public"."invite_request" from "authenticated";

revoke truncate on table "public"."invite_request" from "authenticated";

revoke update on table "public"."invite_request" from "authenticated";

revoke delete on table "public"."invite_request" from "service_role";

revoke insert on table "public"."invite_request" from "service_role";

revoke references on table "public"."invite_request" from "service_role";

revoke select on table "public"."invite_request" from "service_role";

revoke trigger on table "public"."invite_request" from "service_role";

revoke truncate on table "public"."invite_request" from "service_role";

revoke update on table "public"."invite_request" from "service_role";

alter table "public"."invite_request" drop constraint "invite_request_project_id_fkey";

alter table "public"."invite_request" drop constraint "invite_request_receiver_profile_id_fkey";

alter table "public"."invite_request" drop constraint "invite_request_sender_profile_id_fkey";

drop function if exists "public"."handle_invite_request_trigger"();

drop function if exists "public"."link_profile_to_invite_requests"();

drop function if exists "public"."set_receiver_profile_on_invite_request"();

alter table "public"."invite_request" drop constraint "invite_request_pkey";

drop index if exists "public"."idx_invite_request_receiver_email";

drop index if exists "public"."invite_request_pkey";

drop table "public"."invite_request";

create table "public"."invite" (
    "id" uuid not null default gen_random_uuid(),
    "sender_profile_id" uuid not null,
    "receiver_profile_id" uuid,
    "project_id" uuid not null,
    "status" text not null,
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now(),
    "as_owner" boolean not null default false,
    "email" text not null,
    "count" integer not null,
    "active" boolean not null default true
);


alter table "public"."invite" enable row level security;

create table "public"."request" (
    "id" uuid not null default gen_random_uuid(),
    "sender_profile_id" uuid not null,
    "project_id" uuid not null,
    "status" text not null,
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now(),
    "count" integer not null,
    "active" boolean not null default true
);


alter table "public"."request" enable row level security;

alter table "public"."profile_project_link" alter column "membership" set default 'member'::text;

alter table "public"."profile_project_link" alter column "membership" set not null;

CREATE UNIQUE INDEX request_pkey ON public.request USING btree (id);

CREATE INDEX idx_invite_request_receiver_email ON public.invite USING btree (email) WHERE (receiver_profile_id IS NULL);

CREATE UNIQUE INDEX invite_request_pkey ON public.invite USING btree (id);

alter table "public"."invite" add constraint "invite_request_pkey" PRIMARY KEY using index "invite_request_pkey";

alter table "public"."request" add constraint "request_pkey" PRIMARY KEY using index "request_pkey";

alter table "public"."invite" add constraint "invite_request_project_id_fkey" FOREIGN KEY (project_id) REFERENCES project(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."invite" validate constraint "invite_request_project_id_fkey";

alter table "public"."invite" add constraint "invite_request_receiver_profile_id_fkey" FOREIGN KEY (receiver_profile_id) REFERENCES profile(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."invite" validate constraint "invite_request_receiver_profile_id_fkey";

alter table "public"."invite" add constraint "invite_request_sender_profile_id_fkey" FOREIGN KEY (sender_profile_id) REFERENCES profile(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."invite" validate constraint "invite_request_sender_profile_id_fkey";

alter table "public"."invite" add constraint "invite_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text]))) not valid;

alter table "public"."invite" validate constraint "invite_status_check";

alter table "public"."profile_project_link" add constraint "profile_project_link_membership_check" CHECK ((membership = ANY (ARRAY['member'::text, 'owner'::text]))) not valid;

alter table "public"."profile_project_link" validate constraint "profile_project_link_membership_check";

alter table "public"."request" add constraint "invite_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text]))) not valid;

alter table "public"."request" validate constraint "invite_status_check";

alter table "public"."request" add constraint "request_project_id_fkey" FOREIGN KEY (project_id) REFERENCES project(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."request" validate constraint "request_project_id_fkey";

alter table "public"."request" add constraint "request_sender_profile_id_fkey" FOREIGN KEY (sender_profile_id) REFERENCES profile(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."request" validate constraint "request_sender_profile_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_invite_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$declare
  _base_url   text;
  _sr_key     text;
begin
  /* ── 1. fetch the two secrets (decrypted on-the-fly) ──────────────── */
  select decrypted_secret
    into strict _base_url
    from vault.decrypted_secrets
   where name = 'supabase_url'
   limit 1;

  select decrypted_secret
    into strict _sr_key
    from vault.decrypted_secrets
   where name = 'supabase_service_role_key'
   limit 1;

  /* ── 2. fire the Edge Function only when status → awaiting_trigger ── */
  if NEW.status = 'pending'
     and (OLD.status is null or OLD.status <> 'pending') then

    perform net.http_post(
      url      := _base_url || '/functions/v1/send-email',
      headers  := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || _sr_key),
      body     := jsonb_build_object(
                    'type',   'invite',
                    'record', jsonb_build_object(
                                'id',               NEW.id,
                                'sender_profile_id',NEW.sender_profile_id,
                                'receiver_email',   NEW.email,
                                'project_id',       NEW.project_id,
                                'status',           NEW.status))
    );
  end if;

  return NEW;
end;$function$
;

CREATE OR REPLACE FUNCTION public.link_profile_to_invites()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$BEGIN
  UPDATE public.invite
  SET    receiver_profile_id = NEW.id,
         last_updated        = now()
  WHERE  email = NEW.email
    AND  receiver_profile_id IS NULL;

  RETURN NEW;
END;$function$
;

CREATE OR REPLACE FUNCTION public.set_receiver_profile_on_invite()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$DECLARE
  v_profile_id uuid;
BEGIN
  -- Only link if the caller didn’t already supply a receiver_profile_id
  IF NEW.receiver_profile_id IS NULL THEN
    SELECT id
    INTO   v_profile_id
    FROM   public.profile
    WHERE  email = NEW.email
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
      NEW.receiver_profile_id := v_profile_id;  -- link the profile
      NEW.last_updated        := now();         -- keep timestamp accurate
    END IF;
  END IF;

  RETURN NEW;
END;$function$
;

grant delete on table "public"."invite" to "anon";

grant insert on table "public"."invite" to "anon";

grant references on table "public"."invite" to "anon";

grant select on table "public"."invite" to "anon";

grant trigger on table "public"."invite" to "anon";

grant truncate on table "public"."invite" to "anon";

grant update on table "public"."invite" to "anon";

grant delete on table "public"."invite" to "authenticated";

grant insert on table "public"."invite" to "authenticated";

grant references on table "public"."invite" to "authenticated";

grant select on table "public"."invite" to "authenticated";

grant trigger on table "public"."invite" to "authenticated";

grant truncate on table "public"."invite" to "authenticated";

grant update on table "public"."invite" to "authenticated";

grant delete on table "public"."invite" to "service_role";

grant insert on table "public"."invite" to "service_role";

grant references on table "public"."invite" to "service_role";

grant select on table "public"."invite" to "service_role";

grant trigger on table "public"."invite" to "service_role";

grant truncate on table "public"."invite" to "service_role";

grant update on table "public"."invite" to "service_role";

grant delete on table "public"."request" to "anon";

grant insert on table "public"."request" to "anon";

grant references on table "public"."request" to "anon";

grant select on table "public"."request" to "anon";

grant trigger on table "public"."request" to "anon";

grant truncate on table "public"."request" to "anon";

grant update on table "public"."request" to "anon";

grant delete on table "public"."request" to "authenticated";

grant insert on table "public"."request" to "authenticated";

grant references on table "public"."request" to "authenticated";

grant select on table "public"."request" to "authenticated";

grant trigger on table "public"."request" to "authenticated";

grant truncate on table "public"."request" to "authenticated";

grant update on table "public"."request" to "authenticated";

grant delete on table "public"."request" to "service_role";

grant insert on table "public"."request" to "service_role";

grant references on table "public"."request" to "service_role";

grant select on table "public"."request" to "service_role";

grant trigger on table "public"."request" to "service_role";

grant truncate on table "public"."request" to "service_role";

grant update on table "public"."request" to "service_role";

create policy "Project members can view project invitations"
on "public"."invite"
as permissive
for select
to authenticated
using (((sender_profile_id = auth.uid()) OR (receiver_profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.project_id = invite.project_id) AND (ppl.profile_id = auth.uid()) AND (ppl.active = true) AND (ppl.membership = ANY (ARRAY['member'::text, 'owner'::text])))))));


create policy "Project owners can create invitations"
on "public"."invite"
as permissive
for insert
to authenticated
with check (((sender_profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.project_id = invite.project_id) AND (ppl.profile_id = auth.uid()) AND (ppl.membership = 'owner'::text) AND (ppl.active = true))))));


create policy "Users can update their own invitations"
on "public"."invite"
as permissive
for update
to authenticated
using (((sender_profile_id = auth.uid()) OR (receiver_profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.project_id = invite.project_id) AND (ppl.profile_id = auth.uid()) AND (ppl.membership = 'owner'::text) AND (ppl.active = true))))))
with check (((sender_profile_id = auth.uid()) OR (receiver_profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.project_id = invite.project_id) AND (ppl.profile_id = auth.uid()) AND (ppl.membership = 'owner'::text) AND (ppl.active = true))))));


create policy "auth users can create request"
on "public"."request"
as permissive
for insert
to authenticated
with check ((sender_profile_id = auth.uid()));


create policy "sender or project owner can read"
on "public"."request"
as permissive
for select
to authenticated
using (((auth.uid() = sender_profile_id) OR (EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.project_id = request.project_id) AND (ppl.profile_id = auth.uid()) AND ppl.active AND (ppl.membership = 'owner'::text))))));


create policy "sender or project owner can update"
on "public"."request"
as permissive
for update
to authenticated
using (((auth.uid() = sender_profile_id) OR (EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.project_id = request.project_id) AND (ppl.profile_id = auth.uid()) AND ppl.active AND (ppl.membership = 'owner'::text))))))
with check (((auth.uid() = sender_profile_id) OR (EXISTS ( SELECT 1
   FROM profile_project_link ppl
  WHERE ((ppl.project_id = request.project_id) AND (ppl.profile_id = auth.uid()) AND ppl.active AND (ppl.membership = 'owner'::text))))));


CREATE TRIGGER before_invite_set_receiver BEFORE INSERT ON public.invite FOR EACH ROW EXECUTE FUNCTION set_receiver_profile_on_invite();

CREATE TRIGGER on_invite_awaiting_trigger AFTER INSERT OR UPDATE ON public.invite FOR EACH ROW EXECUTE FUNCTION handle_invite_trigger();

CREATE TRIGGER on_profile_created_link_invites AFTER INSERT ON public.profile FOR EACH ROW WHEN ((new.email IS NOT NULL)) EXECUTE FUNCTION link_profile_to_invites();


alter publication "powersync" add table only "public"."invite";

alter publication "powersync" add table only "public"."request";