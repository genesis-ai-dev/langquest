create table "public"."translation_reports" (
    "id" uuid not null default gen_random_uuid(),
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now(),
    "translation_id" uuid not null,
    "reporter_id" uuid,
    "reason" text not null,
    "details" text
);


alter table "public"."translation_reports" enable row level security;

CREATE UNIQUE INDEX translation_reports_pkey ON public.translation_reports USING btree (id);

alter table "public"."translation_reports" add constraint "translation_reports_pkey" PRIMARY KEY using index "translation_reports_pkey";

alter table "public"."translation_reports" add constraint "translation_reports_reporter_id_fkey" FOREIGN KEY (reporter_id) REFERENCES profile(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."translation_reports" validate constraint "translation_reports_reporter_id_fkey";

alter table "public"."translation_reports" add constraint "translation_reports_translation_id_fkey" FOREIGN KEY (translation_id) REFERENCES translation(id) ON UPDATE CASCADE not valid;

alter table "public"."translation_reports" validate constraint "translation_reports_translation_id_fkey";

grant delete on table "public"."translation_reports" to "anon";

grant insert on table "public"."translation_reports" to "anon";

grant references on table "public"."translation_reports" to "anon";

grant select on table "public"."translation_reports" to "anon";

grant trigger on table "public"."translation_reports" to "anon";

grant truncate on table "public"."translation_reports" to "anon";

grant update on table "public"."translation_reports" to "anon";

grant delete on table "public"."translation_reports" to "authenticated";

grant insert on table "public"."translation_reports" to "authenticated";

grant references on table "public"."translation_reports" to "authenticated";

grant select on table "public"."translation_reports" to "authenticated";

grant trigger on table "public"."translation_reports" to "authenticated";

grant truncate on table "public"."translation_reports" to "authenticated";

grant update on table "public"."translation_reports" to "authenticated";

grant delete on table "public"."translation_reports" to "service_role";

grant insert on table "public"."translation_reports" to "service_role";

grant references on table "public"."translation_reports" to "service_role";

grant select on table "public"."translation_reports" to "service_role";

grant trigger on table "public"."translation_reports" to "service_role";

grant truncate on table "public"."translation_reports" to "service_role";

grant update on table "public"."translation_reports" to "service_role";

create policy "Enable insert for authenticated users only"
on "public"."translation_reports"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for all users"
on "public"."translation_reports"
as permissive
for select
to public
using (true);