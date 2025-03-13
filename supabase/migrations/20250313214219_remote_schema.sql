create table "public"."asset" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null,
    "last_updated" timestamp with time zone not null default now(),
    "name" text not null,
    "source_language_id" uuid not null,
    "images" text,
    "active" boolean not null default true
);


alter table "public"."asset" enable row level security;

create table "public"."asset_content_link" (
    "id" text not null,
    "created_at" text not null default CURRENT_TIMESTAMP,
    "last_updated" text not null default CURRENT_TIMESTAMP,
    "asset_id" uuid not null,
    "audio_id" text,
    "text" text not null,
    "active" boolean not null default true
);


alter table "public"."asset_content_link" enable row level security;

create table "public"."asset_download" (
    "profile_id" uuid not null,
    "asset_id" uuid not null,
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now()
);


alter table "public"."asset_download" enable row level security;

create table "public"."asset_tag_link" (
    "asset_id" uuid not null,
    "tag_id" uuid not null,
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "last_modified" timestamp with time zone not null default now()
);


alter table "public"."asset_tag_link" enable row level security;

create table "public"."language" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now(),
    "native_name" text not null,
    "english_name" text not null,
    "iso639_3" text not null,
    "ui_ready" boolean not null default true,
    "creator_id" uuid,
    "active" boolean not null default true
);


alter table "public"."language" enable row level security;

create table "public"."profile" (
    "id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now(),
    "username" text,
    "password" text,
    "ui_language_id" uuid,
    "active" boolean not null default true,
    "terms_accepted" boolean not null default false,
    "terms_version" text
);


alter table "public"."profile" enable row level security;

create table "public"."project" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now(),
    "name" text not null,
    "description" text,
    "source_language_id" uuid not null,
    "target_language_id" uuid not null,
    "active" boolean default true
);


alter table "public"."project" enable row level security;

create table "public"."project_download" (
    "profile_id" uuid not null,
    "project_id" uuid not null,
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now()
);


alter table "public"."project_download" enable row level security;

create table "public"."quest" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now(),
    "name" text,
    "description" text,
    "project_id" uuid not null,
    "active" boolean not null default true
);


alter table "public"."quest" enable row level security;

create table "public"."quest_asset_link" (
    "quest_id" uuid not null,
    "asset_id" uuid not null,
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now()
);


alter table "public"."quest_asset_link" enable row level security;

create table "public"."quest_download" (
    "profile_id" uuid not null,
    "quest_id" uuid not null,
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now()
);


alter table "public"."quest_download" enable row level security;

create table "public"."quest_tag_link" (
    "quest_id" uuid not null,
    "tag_id" uuid not null,
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now()
);


alter table "public"."quest_tag_link" enable row level security;

create table "public"."tag" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now(),
    "name" text not null,
    "active" boolean not null default true
);


alter table "public"."tag" enable row level security;

create table "public"."translation" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now(),
    "asset_id" uuid not null,
    "target_language_id" uuid not null,
    "text" text,
    "audio" text,
    "creator_id" uuid,
    "active" boolean not null default true
);


alter table "public"."translation" enable row level security;

create table "public"."vote" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "last_updated" timestamp with time zone not null default now(),
    "translation_id" uuid not null,
    "polarity" text not null,
    "comment" text,
    "creator_id" uuid,
    "active" boolean not null default true
);


alter table "public"."vote" enable row level security;

CREATE UNIQUE INDEX asset_content_link_pkey ON public.asset_content_link USING btree (id);

CREATE UNIQUE INDEX asset_download_pkey ON public.asset_download USING btree (profile_id, asset_id);

CREATE UNIQUE INDEX asset_tags_pkey ON public.asset_tag_link USING btree (asset_id, tag_id);

CREATE UNIQUE INDEX assets_pkey ON public.asset USING btree (id);

CREATE UNIQUE INDEX languages_pkey ON public.language USING btree (id);

CREATE UNIQUE INDEX project_download_pkey ON public.project_download USING btree (profile_id, project_id);

CREATE UNIQUE INDEX projects_pkey ON public.project USING btree (id);

CREATE UNIQUE INDEX quest_asset_link_pkey ON public.quest_asset_link USING btree (quest_id, asset_id);

CREATE UNIQUE INDEX quest_download_pkey ON public.quest_download USING btree (profile_id, quest_id);

CREATE UNIQUE INDEX quest_tags_pkey ON public.quest_tag_link USING btree (quest_id, tag_id);

CREATE UNIQUE INDEX quests_pkey ON public.quest USING btree (id);

CREATE UNIQUE INDEX tags_pkey ON public.tag USING btree (id);

CREATE UNIQUE INDEX translations_pkey ON public.translation USING btree (id);

CREATE UNIQUE INDEX users_pkey ON public.profile USING btree (id);

CREATE UNIQUE INDEX votes_pkey ON public.vote USING btree (id);

alter table "public"."asset" add constraint "assets_pkey" PRIMARY KEY using index "assets_pkey";

alter table "public"."asset_content_link" add constraint "asset_content_link_pkey" PRIMARY KEY using index "asset_content_link_pkey";

alter table "public"."asset_download" add constraint "asset_download_pkey" PRIMARY KEY using index "asset_download_pkey";

alter table "public"."asset_tag_link" add constraint "asset_tags_pkey" PRIMARY KEY using index "asset_tags_pkey";

alter table "public"."language" add constraint "languages_pkey" PRIMARY KEY using index "languages_pkey";

alter table "public"."profile" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."project" add constraint "projects_pkey" PRIMARY KEY using index "projects_pkey";

alter table "public"."project_download" add constraint "project_download_pkey" PRIMARY KEY using index "project_download_pkey";

alter table "public"."quest" add constraint "quests_pkey" PRIMARY KEY using index "quests_pkey";

alter table "public"."quest_asset_link" add constraint "quest_asset_link_pkey" PRIMARY KEY using index "quest_asset_link_pkey";

alter table "public"."quest_download" add constraint "quest_download_pkey" PRIMARY KEY using index "quest_download_pkey";

alter table "public"."quest_tag_link" add constraint "quest_tags_pkey" PRIMARY KEY using index "quest_tags_pkey";

alter table "public"."tag" add constraint "tags_pkey" PRIMARY KEY using index "tags_pkey";

alter table "public"."translation" add constraint "translations_pkey" PRIMARY KEY using index "translations_pkey";

alter table "public"."vote" add constraint "votes_pkey" PRIMARY KEY using index "votes_pkey";

alter table "public"."asset" add constraint "assets_source_language_id_fkey" FOREIGN KEY (source_language_id) REFERENCES language(id) ON DELETE RESTRICT not valid;

alter table "public"."asset" validate constraint "assets_source_language_id_fkey";

alter table "public"."asset_content_link" add constraint "asset_content_link_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES asset(id) not valid;

alter table "public"."asset_content_link" validate constraint "asset_content_link_asset_id_fkey";

alter table "public"."asset_download" add constraint "asset_download_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES asset(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."asset_download" validate constraint "asset_download_asset_id_fkey";

alter table "public"."asset_download" add constraint "asset_download_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profile(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."asset_download" validate constraint "asset_download_profile_id_fkey";

alter table "public"."asset_tag_link" add constraint "asset_tags_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES asset(id) ON DELETE CASCADE not valid;

alter table "public"."asset_tag_link" validate constraint "asset_tags_asset_id_fkey";

alter table "public"."asset_tag_link" add constraint "asset_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE not valid;

alter table "public"."asset_tag_link" validate constraint "asset_tags_tag_id_fkey";

alter table "public"."language" add constraint "languages_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES profile(id) ON DELETE SET NULL not valid;

alter table "public"."language" validate constraint "languages_creator_id_fkey";

alter table "public"."profile" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profile" validate constraint "profiles_id_fkey";

alter table "public"."profile" add constraint "users_ui_language_id_fkey" FOREIGN KEY (ui_language_id) REFERENCES language(id) ON DELETE SET NULL not valid;

alter table "public"."profile" validate constraint "users_ui_language_id_fkey";

alter table "public"."project" add constraint "projects_source_language_id_fkey" FOREIGN KEY (source_language_id) REFERENCES language(id) ON DELETE RESTRICT not valid;

alter table "public"."project" validate constraint "projects_source_language_id_fkey";

alter table "public"."project" add constraint "projects_target_language_id_fkey" FOREIGN KEY (target_language_id) REFERENCES language(id) ON DELETE RESTRICT not valid;

alter table "public"."project" validate constraint "projects_target_language_id_fkey";

alter table "public"."project_download" add constraint "project_download_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profile(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."project_download" validate constraint "project_download_profile_id_fkey";

alter table "public"."project_download" add constraint "project_download_project_id_fkey" FOREIGN KEY (project_id) REFERENCES project(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."project_download" validate constraint "project_download_project_id_fkey";

alter table "public"."quest" add constraint "quests_project_id_fkey" FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE not valid;

alter table "public"."quest" validate constraint "quests_project_id_fkey";

alter table "public"."quest_asset_link" add constraint "quest_assets_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES asset(id) ON DELETE CASCADE not valid;

alter table "public"."quest_asset_link" validate constraint "quest_assets_asset_id_fkey";

alter table "public"."quest_asset_link" add constraint "quest_assets_quest_id_fkey" FOREIGN KEY (quest_id) REFERENCES quest(id) ON DELETE CASCADE not valid;

alter table "public"."quest_asset_link" validate constraint "quest_assets_quest_id_fkey";

alter table "public"."quest_download" add constraint "quest_download_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profile(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."quest_download" validate constraint "quest_download_profile_id_fkey";

alter table "public"."quest_download" add constraint "quest_download_quest_id_fkey" FOREIGN KEY (quest_id) REFERENCES quest(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."quest_download" validate constraint "quest_download_quest_id_fkey";

alter table "public"."quest_tag_link" add constraint "quest_tags_quest_id_fkey" FOREIGN KEY (quest_id) REFERENCES quest(id) ON DELETE CASCADE not valid;

alter table "public"."quest_tag_link" validate constraint "quest_tags_quest_id_fkey";

alter table "public"."quest_tag_link" add constraint "quest_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE not valid;

alter table "public"."quest_tag_link" validate constraint "quest_tags_tag_id_fkey";

alter table "public"."translation" add constraint "translations_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES asset(id) ON DELETE CASCADE not valid;

alter table "public"."translation" validate constraint "translations_asset_id_fkey";

alter table "public"."translation" add constraint "translations_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES profile(id) ON DELETE SET NULL not valid;

alter table "public"."translation" validate constraint "translations_creator_id_fkey";

alter table "public"."translation" add constraint "translations_target_language_id_fkey" FOREIGN KEY (target_language_id) REFERENCES language(id) ON DELETE RESTRICT not valid;

alter table "public"."translation" validate constraint "translations_target_language_id_fkey";

alter table "public"."vote" add constraint "votes_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES profile(id) ON DELETE SET NULL not valid;

alter table "public"."vote" validate constraint "votes_creator_id_fkey";

alter table "public"."vote" add constraint "votes_translation_id_fkey" FOREIGN KEY (translation_id) REFERENCES translation(id) ON DELETE CASCADE not valid;

alter table "public"."vote" validate constraint "votes_translation_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_user_conversion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if new.is_anonymous = false 
     and new.email_confirmed_at is not null 
     and old.email_confirmed_at is null 
  then
    insert into public.profile (
      id, 
      username,
      ui_language_id
    )
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
      case 
        -- when new.raw_user_meta_data ->> 'ui_language_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        -- then (new.raw_user_meta_data ->> 'ui_language_id')::uuid
        -- else null
        when uuid(new.raw_user_meta_data ->> 'ui_language_id') is not null 
        then (new.raw_user_meta_data ->> 'ui_language_id')::uuid
        else null
      end
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$function$
;

grant delete on table "public"."asset" to "anon";

grant insert on table "public"."asset" to "anon";

grant references on table "public"."asset" to "anon";

grant select on table "public"."asset" to "anon";

grant trigger on table "public"."asset" to "anon";

grant truncate on table "public"."asset" to "anon";

grant update on table "public"."asset" to "anon";

grant delete on table "public"."asset" to "authenticated";

grant insert on table "public"."asset" to "authenticated";

grant references on table "public"."asset" to "authenticated";

grant select on table "public"."asset" to "authenticated";

grant trigger on table "public"."asset" to "authenticated";

grant truncate on table "public"."asset" to "authenticated";

grant update on table "public"."asset" to "authenticated";

grant delete on table "public"."asset" to "service_role";

grant insert on table "public"."asset" to "service_role";

grant references on table "public"."asset" to "service_role";

grant select on table "public"."asset" to "service_role";

grant trigger on table "public"."asset" to "service_role";

grant truncate on table "public"."asset" to "service_role";

grant update on table "public"."asset" to "service_role";

grant delete on table "public"."asset_content_link" to "anon";

grant insert on table "public"."asset_content_link" to "anon";

grant references on table "public"."asset_content_link" to "anon";

grant select on table "public"."asset_content_link" to "anon";

grant trigger on table "public"."asset_content_link" to "anon";

grant truncate on table "public"."asset_content_link" to "anon";

grant update on table "public"."asset_content_link" to "anon";

grant delete on table "public"."asset_content_link" to "authenticated";

grant insert on table "public"."asset_content_link" to "authenticated";

grant references on table "public"."asset_content_link" to "authenticated";

grant select on table "public"."asset_content_link" to "authenticated";

grant trigger on table "public"."asset_content_link" to "authenticated";

grant truncate on table "public"."asset_content_link" to "authenticated";

grant update on table "public"."asset_content_link" to "authenticated";

grant delete on table "public"."asset_content_link" to "service_role";

grant insert on table "public"."asset_content_link" to "service_role";

grant references on table "public"."asset_content_link" to "service_role";

grant select on table "public"."asset_content_link" to "service_role";

grant trigger on table "public"."asset_content_link" to "service_role";

grant truncate on table "public"."asset_content_link" to "service_role";

grant update on table "public"."asset_content_link" to "service_role";

grant delete on table "public"."asset_download" to "anon";

grant insert on table "public"."asset_download" to "anon";

grant references on table "public"."asset_download" to "anon";

grant select on table "public"."asset_download" to "anon";

grant trigger on table "public"."asset_download" to "anon";

grant truncate on table "public"."asset_download" to "anon";

grant update on table "public"."asset_download" to "anon";

grant delete on table "public"."asset_download" to "authenticated";

grant insert on table "public"."asset_download" to "authenticated";

grant references on table "public"."asset_download" to "authenticated";

grant select on table "public"."asset_download" to "authenticated";

grant trigger on table "public"."asset_download" to "authenticated";

grant truncate on table "public"."asset_download" to "authenticated";

grant update on table "public"."asset_download" to "authenticated";

grant delete on table "public"."asset_download" to "service_role";

grant insert on table "public"."asset_download" to "service_role";

grant references on table "public"."asset_download" to "service_role";

grant select on table "public"."asset_download" to "service_role";

grant trigger on table "public"."asset_download" to "service_role";

grant truncate on table "public"."asset_download" to "service_role";

grant update on table "public"."asset_download" to "service_role";

grant delete on table "public"."asset_tag_link" to "anon";

grant insert on table "public"."asset_tag_link" to "anon";

grant references on table "public"."asset_tag_link" to "anon";

grant select on table "public"."asset_tag_link" to "anon";

grant trigger on table "public"."asset_tag_link" to "anon";

grant truncate on table "public"."asset_tag_link" to "anon";

grant update on table "public"."asset_tag_link" to "anon";

grant delete on table "public"."asset_tag_link" to "authenticated";

grant insert on table "public"."asset_tag_link" to "authenticated";

grant references on table "public"."asset_tag_link" to "authenticated";

grant select on table "public"."asset_tag_link" to "authenticated";

grant trigger on table "public"."asset_tag_link" to "authenticated";

grant truncate on table "public"."asset_tag_link" to "authenticated";

grant update on table "public"."asset_tag_link" to "authenticated";

grant delete on table "public"."asset_tag_link" to "service_role";

grant insert on table "public"."asset_tag_link" to "service_role";

grant references on table "public"."asset_tag_link" to "service_role";

grant select on table "public"."asset_tag_link" to "service_role";

grant trigger on table "public"."asset_tag_link" to "service_role";

grant truncate on table "public"."asset_tag_link" to "service_role";

grant update on table "public"."asset_tag_link" to "service_role";

grant delete on table "public"."language" to "anon";

grant insert on table "public"."language" to "anon";

grant references on table "public"."language" to "anon";

grant select on table "public"."language" to "anon";

grant trigger on table "public"."language" to "anon";

grant truncate on table "public"."language" to "anon";

grant update on table "public"."language" to "anon";

grant delete on table "public"."language" to "authenticated";

grant insert on table "public"."language" to "authenticated";

grant references on table "public"."language" to "authenticated";

grant select on table "public"."language" to "authenticated";

grant trigger on table "public"."language" to "authenticated";

grant truncate on table "public"."language" to "authenticated";

grant update on table "public"."language" to "authenticated";

grant delete on table "public"."language" to "service_role";

grant insert on table "public"."language" to "service_role";

grant references on table "public"."language" to "service_role";

grant select on table "public"."language" to "service_role";

grant trigger on table "public"."language" to "service_role";

grant truncate on table "public"."language" to "service_role";

grant update on table "public"."language" to "service_role";

grant delete on table "public"."profile" to "anon";

grant insert on table "public"."profile" to "anon";

grant references on table "public"."profile" to "anon";

grant select on table "public"."profile" to "anon";

grant trigger on table "public"."profile" to "anon";

grant truncate on table "public"."profile" to "anon";

grant update on table "public"."profile" to "anon";

grant delete on table "public"."profile" to "authenticated";

grant insert on table "public"."profile" to "authenticated";

grant references on table "public"."profile" to "authenticated";

grant select on table "public"."profile" to "authenticated";

grant trigger on table "public"."profile" to "authenticated";

grant truncate on table "public"."profile" to "authenticated";

grant update on table "public"."profile" to "authenticated";

grant delete on table "public"."profile" to "service_role";

grant insert on table "public"."profile" to "service_role";

grant references on table "public"."profile" to "service_role";

grant select on table "public"."profile" to "service_role";

grant trigger on table "public"."profile" to "service_role";

grant truncate on table "public"."profile" to "service_role";

grant update on table "public"."profile" to "service_role";

grant delete on table "public"."project" to "anon";

grant insert on table "public"."project" to "anon";

grant references on table "public"."project" to "anon";

grant select on table "public"."project" to "anon";

grant trigger on table "public"."project" to "anon";

grant truncate on table "public"."project" to "anon";

grant update on table "public"."project" to "anon";

grant delete on table "public"."project" to "authenticated";

grant insert on table "public"."project" to "authenticated";

grant references on table "public"."project" to "authenticated";

grant select on table "public"."project" to "authenticated";

grant trigger on table "public"."project" to "authenticated";

grant truncate on table "public"."project" to "authenticated";

grant update on table "public"."project" to "authenticated";

grant delete on table "public"."project" to "service_role";

grant insert on table "public"."project" to "service_role";

grant references on table "public"."project" to "service_role";

grant select on table "public"."project" to "service_role";

grant trigger on table "public"."project" to "service_role";

grant truncate on table "public"."project" to "service_role";

grant update on table "public"."project" to "service_role";

grant delete on table "public"."project_download" to "anon";

grant insert on table "public"."project_download" to "anon";

grant references on table "public"."project_download" to "anon";

grant select on table "public"."project_download" to "anon";

grant trigger on table "public"."project_download" to "anon";

grant truncate on table "public"."project_download" to "anon";

grant update on table "public"."project_download" to "anon";

grant delete on table "public"."project_download" to "authenticated";

grant insert on table "public"."project_download" to "authenticated";

grant references on table "public"."project_download" to "authenticated";

grant select on table "public"."project_download" to "authenticated";

grant trigger on table "public"."project_download" to "authenticated";

grant truncate on table "public"."project_download" to "authenticated";

grant update on table "public"."project_download" to "authenticated";

grant delete on table "public"."project_download" to "service_role";

grant insert on table "public"."project_download" to "service_role";

grant references on table "public"."project_download" to "service_role";

grant select on table "public"."project_download" to "service_role";

grant trigger on table "public"."project_download" to "service_role";

grant truncate on table "public"."project_download" to "service_role";

grant update on table "public"."project_download" to "service_role";

grant delete on table "public"."quest" to "anon";

grant insert on table "public"."quest" to "anon";

grant references on table "public"."quest" to "anon";

grant select on table "public"."quest" to "anon";

grant trigger on table "public"."quest" to "anon";

grant truncate on table "public"."quest" to "anon";

grant update on table "public"."quest" to "anon";

grant delete on table "public"."quest" to "authenticated";

grant insert on table "public"."quest" to "authenticated";

grant references on table "public"."quest" to "authenticated";

grant select on table "public"."quest" to "authenticated";

grant trigger on table "public"."quest" to "authenticated";

grant truncate on table "public"."quest" to "authenticated";

grant update on table "public"."quest" to "authenticated";

grant delete on table "public"."quest" to "service_role";

grant insert on table "public"."quest" to "service_role";

grant references on table "public"."quest" to "service_role";

grant select on table "public"."quest" to "service_role";

grant trigger on table "public"."quest" to "service_role";

grant truncate on table "public"."quest" to "service_role";

grant update on table "public"."quest" to "service_role";

grant delete on table "public"."quest_asset_link" to "anon";

grant insert on table "public"."quest_asset_link" to "anon";

grant references on table "public"."quest_asset_link" to "anon";

grant select on table "public"."quest_asset_link" to "anon";

grant trigger on table "public"."quest_asset_link" to "anon";

grant truncate on table "public"."quest_asset_link" to "anon";

grant update on table "public"."quest_asset_link" to "anon";

grant delete on table "public"."quest_asset_link" to "authenticated";

grant insert on table "public"."quest_asset_link" to "authenticated";

grant references on table "public"."quest_asset_link" to "authenticated";

grant select on table "public"."quest_asset_link" to "authenticated";

grant trigger on table "public"."quest_asset_link" to "authenticated";

grant truncate on table "public"."quest_asset_link" to "authenticated";

grant update on table "public"."quest_asset_link" to "authenticated";

grant delete on table "public"."quest_asset_link" to "service_role";

grant insert on table "public"."quest_asset_link" to "service_role";

grant references on table "public"."quest_asset_link" to "service_role";

grant select on table "public"."quest_asset_link" to "service_role";

grant trigger on table "public"."quest_asset_link" to "service_role";

grant truncate on table "public"."quest_asset_link" to "service_role";

grant update on table "public"."quest_asset_link" to "service_role";

grant delete on table "public"."quest_download" to "anon";

grant insert on table "public"."quest_download" to "anon";

grant references on table "public"."quest_download" to "anon";

grant select on table "public"."quest_download" to "anon";

grant trigger on table "public"."quest_download" to "anon";

grant truncate on table "public"."quest_download" to "anon";

grant update on table "public"."quest_download" to "anon";

grant delete on table "public"."quest_download" to "authenticated";

grant insert on table "public"."quest_download" to "authenticated";

grant references on table "public"."quest_download" to "authenticated";

grant select on table "public"."quest_download" to "authenticated";

grant trigger on table "public"."quest_download" to "authenticated";

grant truncate on table "public"."quest_download" to "authenticated";

grant update on table "public"."quest_download" to "authenticated";

grant delete on table "public"."quest_download" to "service_role";

grant insert on table "public"."quest_download" to "service_role";

grant references on table "public"."quest_download" to "service_role";

grant select on table "public"."quest_download" to "service_role";

grant trigger on table "public"."quest_download" to "service_role";

grant truncate on table "public"."quest_download" to "service_role";

grant update on table "public"."quest_download" to "service_role";

grant delete on table "public"."quest_tag_link" to "anon";

grant insert on table "public"."quest_tag_link" to "anon";

grant references on table "public"."quest_tag_link" to "anon";

grant select on table "public"."quest_tag_link" to "anon";

grant trigger on table "public"."quest_tag_link" to "anon";

grant truncate on table "public"."quest_tag_link" to "anon";

grant update on table "public"."quest_tag_link" to "anon";

grant delete on table "public"."quest_tag_link" to "authenticated";

grant insert on table "public"."quest_tag_link" to "authenticated";

grant references on table "public"."quest_tag_link" to "authenticated";

grant select on table "public"."quest_tag_link" to "authenticated";

grant trigger on table "public"."quest_tag_link" to "authenticated";

grant truncate on table "public"."quest_tag_link" to "authenticated";

grant update on table "public"."quest_tag_link" to "authenticated";

grant delete on table "public"."quest_tag_link" to "service_role";

grant insert on table "public"."quest_tag_link" to "service_role";

grant references on table "public"."quest_tag_link" to "service_role";

grant select on table "public"."quest_tag_link" to "service_role";

grant trigger on table "public"."quest_tag_link" to "service_role";

grant truncate on table "public"."quest_tag_link" to "service_role";

grant update on table "public"."quest_tag_link" to "service_role";

grant delete on table "public"."tag" to "anon";

grant insert on table "public"."tag" to "anon";

grant references on table "public"."tag" to "anon";

grant select on table "public"."tag" to "anon";

grant trigger on table "public"."tag" to "anon";

grant truncate on table "public"."tag" to "anon";

grant update on table "public"."tag" to "anon";

grant delete on table "public"."tag" to "authenticated";

grant insert on table "public"."tag" to "authenticated";

grant references on table "public"."tag" to "authenticated";

grant select on table "public"."tag" to "authenticated";

grant trigger on table "public"."tag" to "authenticated";

grant truncate on table "public"."tag" to "authenticated";

grant update on table "public"."tag" to "authenticated";

grant delete on table "public"."tag" to "service_role";

grant insert on table "public"."tag" to "service_role";

grant references on table "public"."tag" to "service_role";

grant select on table "public"."tag" to "service_role";

grant trigger on table "public"."tag" to "service_role";

grant truncate on table "public"."tag" to "service_role";

grant update on table "public"."tag" to "service_role";

grant delete on table "public"."translation" to "anon";

grant insert on table "public"."translation" to "anon";

grant references on table "public"."translation" to "anon";

grant select on table "public"."translation" to "anon";

grant trigger on table "public"."translation" to "anon";

grant truncate on table "public"."translation" to "anon";

grant update on table "public"."translation" to "anon";

grant delete on table "public"."translation" to "authenticated";

grant insert on table "public"."translation" to "authenticated";

grant references on table "public"."translation" to "authenticated";

grant select on table "public"."translation" to "authenticated";

grant trigger on table "public"."translation" to "authenticated";

grant truncate on table "public"."translation" to "authenticated";

grant update on table "public"."translation" to "authenticated";

grant delete on table "public"."translation" to "service_role";

grant insert on table "public"."translation" to "service_role";

grant references on table "public"."translation" to "service_role";

grant select on table "public"."translation" to "service_role";

grant trigger on table "public"."translation" to "service_role";

grant truncate on table "public"."translation" to "service_role";

grant update on table "public"."translation" to "service_role";

grant delete on table "public"."vote" to "anon";

grant insert on table "public"."vote" to "anon";

grant references on table "public"."vote" to "anon";

grant select on table "public"."vote" to "anon";

grant trigger on table "public"."vote" to "anon";

grant truncate on table "public"."vote" to "anon";

grant update on table "public"."vote" to "anon";

grant delete on table "public"."vote" to "authenticated";

grant insert on table "public"."vote" to "authenticated";

grant references on table "public"."vote" to "authenticated";

grant select on table "public"."vote" to "authenticated";

grant trigger on table "public"."vote" to "authenticated";

grant truncate on table "public"."vote" to "authenticated";

grant update on table "public"."vote" to "authenticated";

grant delete on table "public"."vote" to "service_role";

grant insert on table "public"."vote" to "service_role";

grant references on table "public"."vote" to "service_role";

grant select on table "public"."vote" to "service_role";

grant trigger on table "public"."vote" to "service_role";

grant truncate on table "public"."vote" to "service_role";

grant update on table "public"."vote" to "service_role";

create policy "Enable ALL for users by id"
on "public"."asset"
as permissive
for all
to authenticated, anon
using ((( SELECT auth.uid() AS uid) = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::uuid, '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::uuid, 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::uuid, 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::uuid, 'ff6e4bb4-3840-4168-917a-d29e09145958'::uuid])));


create policy "Enable read access for all users"
on "public"."asset"
as permissive
for select
to public
using (true);


create policy "Enable ALL for users by id"
on "public"."asset_content_link"
as permissive
for all
to anon, authenticated
using ((( SELECT auth.uid() AS uid) = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::uuid, '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::uuid, 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::uuid, 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::uuid, 'ff6e4bb4-3840-4168-917a-d29e09145958'::uuid])));


create policy "Enable read access for all users"
on "public"."asset_content_link"
as permissive
for select
to public
using (true);


create policy "Enable insert for authenticated users only"
on "public"."asset_download"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable select for authenticated users only"
on "public"."asset_download"
as permissive
for select
to authenticated
using ((auth.uid() = profile_id));


create policy "Enable update for authenticated users only"
on "public"."asset_download"
as permissive
for update
to authenticated
using ((auth.uid() = profile_id))
with check ((auth.uid() = profile_id));


create policy "Enable ALL for users by id"
on "public"."asset_tag_link"
as permissive
for all
to anon, authenticated
using ((( SELECT auth.uid() AS uid) = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::uuid, '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::uuid, 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::uuid, 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::uuid, 'ff6e4bb4-3840-4168-917a-d29e09145958'::uuid])));


create policy "Enable read access for all users"
on "public"."asset_tag_link"
as permissive
for select
to public
using (true);


create policy "Enable read access for all users"
on "public"."language"
as permissive
for select
to public
using (true);


create policy "Users can read own profile"
on "public"."profile"
as permissive
for select
to public
using ((auth.uid() = id));


create policy "Users can update own profile"
on "public"."profile"
as permissive
for update
to public
using ((auth.uid() = id))
with check ((auth.uid() = id));


create policy "Enable ALL for users by id"
on "public"."project"
as permissive
for all
to public
using ((( SELECT auth.uid() AS uid) = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::uuid, '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::uuid, 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::uuid, 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::uuid, 'ff6e4bb4-3840-4168-917a-d29e09145958'::uuid])));


create policy "Enable read access for all users"
on "public"."project"
as permissive
for select
to public
using (true);


create policy "Enable insert for authenticated users only"
on "public"."project_download"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for auth users"
on "public"."project_download"
as permissive
for select
to authenticated
using (true);


create policy "Enable update for authenticated users only"
on "public"."project_download"
as permissive
for update
to authenticated
using ((auth.uid() = profile_id))
with check ((auth.uid() = profile_id));


create policy "Enable ALL for users by id"
on "public"."quest"
as permissive
for all
to anon, authenticated
using ((( SELECT auth.uid() AS uid) = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::uuid, '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::uuid, 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::uuid, 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::uuid, 'ff6e4bb4-3840-4168-917a-d29e09145958'::uuid])));


create policy "Enable read access for all users"
on "public"."quest"
as permissive
for select
to public
using (true);


create policy "Enable ALL for users by id"
on "public"."quest_asset_link"
as permissive
for all
to authenticated, anon
using ((( SELECT auth.uid() AS uid) = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::uuid, '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::uuid, 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::uuid, 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::uuid, 'ff6e4bb4-3840-4168-917a-d29e09145958'::uuid])));


create policy "Enable read access for all users"
on "public"."quest_asset_link"
as permissive
for select
to public
using (true);


create policy "Enable insert for authenticated users only"
on "public"."quest_download"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable select for authenticated users only"
on "public"."quest_download"
as permissive
for select
to authenticated
using ((auth.uid() = profile_id));


create policy "Enable update for authenticated users only"
on "public"."quest_download"
as permissive
for update
to authenticated
using ((auth.uid() = profile_id))
with check ((auth.uid() = profile_id));


create policy "Enable ALL for users by id"
on "public"."quest_tag_link"
as permissive
for all
to anon, authenticated
using ((( SELECT auth.uid() AS uid) = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::uuid, '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::uuid, 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::uuid, 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::uuid, 'ff6e4bb4-3840-4168-917a-d29e09145958'::uuid])));


create policy "Enable read access for all users"
on "public"."quest_tag_link"
as permissive
for select
to public
using (true);


create policy "Enable ALL for users by id"
on "public"."tag"
as permissive
for all
to anon, authenticated
using ((( SELECT auth.uid() AS uid) = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::uuid, '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::uuid, 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::uuid, 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::uuid, 'ff6e4bb4-3840-4168-917a-d29e09145958'::uuid])));


create policy "Enable read access for all users"
on "public"."tag"
as permissive
for select
to public
using (true);


create policy "Enable insert for authenticated users only"
on "public"."translation"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for all users"
on "public"."translation"
as permissive
for select
to public
using (true);


create policy "Enable insert for authenticated users only"
on "public"."vote"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for all users"
on "public"."vote"
as permissive
for select
to public
using (true);


create policy "Enable update for authenticated users only"
on "public"."vote"
as permissive
for update
to authenticated
using (true);



