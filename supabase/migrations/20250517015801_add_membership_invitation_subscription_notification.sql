create table "public"."invite_request" (
    "id" uuid not null default gen_random_uuid(),
    "sender_profile_id" uuid not null,
    "receiver_profile_id" uuid not null,
    "project_id" uuid not null,
    "type" text not null,
    "status" text not null,
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now()
);


alter table "public"."invite_request" enable row level security;

create table "public"."notification" (
    "id" uuid not null default gen_random_uuid(),
    "profile_id" uuid not null,
    "viewed" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now(),
    "target_table_name" text not null,
    "target_record_id" uuid not null
);


alter table "public"."notification" enable row level security;

create table "public"."profile_project_link" (
    "profile_id" uuid not null,
    "project_id" uuid not null,
    "active" boolean not null default true,
    "membership" text,
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now()
);


alter table "public"."profile_project_link" enable row level security;

create table "public"."subscription" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "profile_id" uuid not null,
    "active" boolean not null default true,
    "last_updated" timestamp with time zone not null default now(),
    "target_record_id" uuid not null,
    "target_table_name" text not null
);


alter table "public"."subscription" enable row level security;

alter table "public"."asset" add column "creator_id" uuid;

alter table "public"."asset" add column "visible" boolean default true;

alter table "public"."project" add column "creator_id" uuid;

alter table "public"."project" add column "private" boolean default false;

alter table "public"."project" add column "visible" boolean default true;

alter table "public"."quest" add column "creator_id" uuid;

alter table "public"."quest" add column "visible" boolean default true;

alter table "public"."translation" add column "visible" boolean default true;

CREATE UNIQUE INDEX invite_request_pkey ON public.invite_request USING btree (id);

CREATE UNIQUE INDEX notification_pkey ON public.notification USING btree (id);

CREATE UNIQUE INDEX profile_project_link_pkey ON public.profile_project_link USING btree (profile_id, project_id);

CREATE UNIQUE INDEX project_subscription_pkey ON public.subscription USING btree (id);

alter table "public"."invite_request" add constraint "invite_request_pkey" PRIMARY KEY using index "invite_request_pkey";

alter table "public"."notification" add constraint "notification_pkey" PRIMARY KEY using index "notification_pkey";

alter table "public"."profile_project_link" add constraint "profile_project_link_pkey" PRIMARY KEY using index "profile_project_link_pkey";

alter table "public"."subscription" add constraint "project_subscription_pkey" PRIMARY KEY using index "project_subscription_pkey";

alter table "public"."asset" add constraint "asset_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES profile(id) not valid;

alter table "public"."asset" validate constraint "asset_creator_id_fkey";

alter table "public"."invite_request" add constraint "invite_request_project_id_fkey" FOREIGN KEY (project_id) REFERENCES project(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."invite_request" validate constraint "invite_request_project_id_fkey";

alter table "public"."invite_request" add constraint "invite_request_receiver_profile_id_fkey" FOREIGN KEY (receiver_profile_id) REFERENCES profile(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."invite_request" validate constraint "invite_request_receiver_profile_id_fkey";

alter table "public"."invite_request" add constraint "invite_request_sender_profile_id_fkey" FOREIGN KEY (sender_profile_id) REFERENCES profile(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."invite_request" validate constraint "invite_request_sender_profile_id_fkey";

alter table "public"."notification" add constraint "notification_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profile(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."notification" validate constraint "notification_profile_id_fkey";

alter table "public"."profile_project_link" add constraint "profile_project_link_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profile(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."profile_project_link" validate constraint "profile_project_link_profile_id_fkey";

alter table "public"."profile_project_link" add constraint "profile_project_link_project_id_fkey" FOREIGN KEY (project_id) REFERENCES project(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."profile_project_link" validate constraint "profile_project_link_project_id_fkey";

alter table "public"."project" add constraint "project_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES profile(id) ON DELETE SET NULL not valid;

alter table "public"."project" validate constraint "project_creator_id_fkey";

alter table "public"."quest" add constraint "quest_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES profile(id) not valid;

alter table "public"."quest" validate constraint "quest_creator_id_fkey";

alter table "public"."subscription" add constraint "project_subscription_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profile(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."subscription" validate constraint "project_subscription_profile_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_user_conversion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$begin
  if new.is_anonymous = false 
     and new.email_confirmed_at is not null 
     and old.email_confirmed_at is null 
  then
    insert into public.profile (
      id, 
      username,
      ui_language_id,
      terms_accepted,
      terms_accepted_at
    )
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
      case 
        when uuid(new.raw_user_meta_data ->> 'ui_language_id') is not null 
        then (new.raw_user_meta_data ->> 'ui_language_id')::uuid
        else null
      end,
      (new.raw_user_meta_data ->> 'terms_accepted')::boolean,
      (new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;$function$
;

grant delete on table "public"."invite_request" to "anon";

grant insert on table "public"."invite_request" to "anon";

grant references on table "public"."invite_request" to "anon";

grant select on table "public"."invite_request" to "anon";

grant trigger on table "public"."invite_request" to "anon";

grant truncate on table "public"."invite_request" to "anon";

grant update on table "public"."invite_request" to "anon";

grant delete on table "public"."invite_request" to "authenticated";

grant insert on table "public"."invite_request" to "authenticated";

grant references on table "public"."invite_request" to "authenticated";

grant select on table "public"."invite_request" to "authenticated";

grant trigger on table "public"."invite_request" to "authenticated";

grant truncate on table "public"."invite_request" to "authenticated";

grant update on table "public"."invite_request" to "authenticated";

grant delete on table "public"."invite_request" to "service_role";

grant insert on table "public"."invite_request" to "service_role";

grant references on table "public"."invite_request" to "service_role";

grant select on table "public"."invite_request" to "service_role";

grant trigger on table "public"."invite_request" to "service_role";

grant truncate on table "public"."invite_request" to "service_role";

grant update on table "public"."invite_request" to "service_role";

grant delete on table "public"."notification" to "anon";

grant insert on table "public"."notification" to "anon";

grant references on table "public"."notification" to "anon";

grant select on table "public"."notification" to "anon";

grant trigger on table "public"."notification" to "anon";

grant truncate on table "public"."notification" to "anon";

grant update on table "public"."notification" to "anon";

grant delete on table "public"."notification" to "authenticated";

grant insert on table "public"."notification" to "authenticated";

grant references on table "public"."notification" to "authenticated";

grant select on table "public"."notification" to "authenticated";

grant trigger on table "public"."notification" to "authenticated";

grant truncate on table "public"."notification" to "authenticated";

grant update on table "public"."notification" to "authenticated";

grant delete on table "public"."notification" to "service_role";

grant insert on table "public"."notification" to "service_role";

grant references on table "public"."notification" to "service_role";

grant select on table "public"."notification" to "service_role";

grant trigger on table "public"."notification" to "service_role";

grant truncate on table "public"."notification" to "service_role";

grant update on table "public"."notification" to "service_role";

grant delete on table "public"."profile_project_link" to "anon";

grant insert on table "public"."profile_project_link" to "anon";

grant references on table "public"."profile_project_link" to "anon";

grant select on table "public"."profile_project_link" to "anon";

grant trigger on table "public"."profile_project_link" to "anon";

grant truncate on table "public"."profile_project_link" to "anon";

grant update on table "public"."profile_project_link" to "anon";

grant delete on table "public"."profile_project_link" to "authenticated";

grant insert on table "public"."profile_project_link" to "authenticated";

grant references on table "public"."profile_project_link" to "authenticated";

grant select on table "public"."profile_project_link" to "authenticated";

grant trigger on table "public"."profile_project_link" to "authenticated";

grant truncate on table "public"."profile_project_link" to "authenticated";

grant update on table "public"."profile_project_link" to "authenticated";

grant delete on table "public"."profile_project_link" to "service_role";

grant insert on table "public"."profile_project_link" to "service_role";

grant references on table "public"."profile_project_link" to "service_role";

grant select on table "public"."profile_project_link" to "service_role";

grant trigger on table "public"."profile_project_link" to "service_role";

grant truncate on table "public"."profile_project_link" to "service_role";

grant update on table "public"."profile_project_link" to "service_role";

grant delete on table "public"."subscription" to "anon";

grant insert on table "public"."subscription" to "anon";

grant references on table "public"."subscription" to "anon";

grant select on table "public"."subscription" to "anon";

grant trigger on table "public"."subscription" to "anon";

grant truncate on table "public"."subscription" to "anon";

grant update on table "public"."subscription" to "anon";

grant delete on table "public"."subscription" to "authenticated";

grant insert on table "public"."subscription" to "authenticated";

grant references on table "public"."subscription" to "authenticated";

grant select on table "public"."subscription" to "authenticated";

grant trigger on table "public"."subscription" to "authenticated";

grant truncate on table "public"."subscription" to "authenticated";

grant update on table "public"."subscription" to "authenticated";

grant delete on table "public"."subscription" to "service_role";

grant insert on table "public"."subscription" to "service_role";

grant references on table "public"."subscription" to "service_role";

grant select on table "public"."subscription" to "service_role";

grant trigger on table "public"."subscription" to "service_role";

grant truncate on table "public"."subscription" to "service_role";

grant update on table "public"."subscription" to "service_role";

alter publication "powersync" add table only "public"."subscription";

alter publication "powersync" add table only "public"."notification";

alter publication "powersync" add table only "public"."profile_project_link";

alter publication "powersync" add table only "public"."invite_request";


