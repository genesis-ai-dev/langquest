alter table "public"."profile" drop column "terms_version";

alter table "public"."profile" add column "terms_accepted_at" timestamp with time zone;


