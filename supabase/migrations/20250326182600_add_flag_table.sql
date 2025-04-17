create table "public"."flag" (
    "id" uuid not null default gen_random_uuid(),
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone,
    "name" text not null
);


alter table "public"."flag" enable row level security;

alter table "public"."profile" add column "avatar" text;

CREATE UNIQUE INDEX flag_name_key ON public.flag USING btree (name);

CREATE UNIQUE INDEX flag_pkey ON public.flag USING btree (id);

alter table "public"."flag" add constraint "flag_pkey" PRIMARY KEY using index "flag_pkey";

alter table "public"."flag" add constraint "flag_name_key" UNIQUE using index "flag_name_key";

grant delete on table "public"."flag" to "anon";

grant insert on table "public"."flag" to "anon";

grant references on table "public"."flag" to "anon";

grant select on table "public"."flag" to "anon";

grant trigger on table "public"."flag" to "anon";

grant truncate on table "public"."flag" to "anon";

grant update on table "public"."flag" to "anon";

grant delete on table "public"."flag" to "authenticated";

grant insert on table "public"."flag" to "authenticated";

grant references on table "public"."flag" to "authenticated";

grant select on table "public"."flag" to "authenticated";

grant trigger on table "public"."flag" to "authenticated";

grant truncate on table "public"."flag" to "authenticated";

grant update on table "public"."flag" to "authenticated";

grant delete on table "public"."flag" to "service_role";

grant insert on table "public"."flag" to "service_role";

grant references on table "public"."flag" to "service_role";

grant select on table "public"."flag" to "service_role";

grant trigger on table "public"."flag" to "service_role";

grant truncate on table "public"."flag" to "service_role";

grant update on table "public"."flag" to "service_role";

create policy "Enable read access for all users"
on "public"."flag"
as permissive
for select
to public
using (true);

alter publication "powersync" add table only "public"."flag";

