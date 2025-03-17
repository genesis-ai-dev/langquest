

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."handle_user_conversion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
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
$_$;


ALTER FUNCTION "public"."handle_user_conversion"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."asset" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "source_language_id" "uuid" NOT NULL,
    "images" "text",
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."asset" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asset_content_link" (
    "id" "text" NOT NULL,
    "created_at" "text" DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "last_updated" "text" DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "audio_id" "text",
    "text" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."asset_content_link" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asset_download" (
    "profile_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."asset_download" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asset_tag_link" (
    "asset_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_modified" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."asset_tag_link" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."language" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "native_name" "text" NOT NULL,
    "english_name" "text" NOT NULL,
    "iso639_3" "text" NOT NULL,
    "ui_ready" boolean DEFAULT true NOT NULL,
    "creator_id" "uuid",
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."language" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "username" "text",
    "password" "text",
    "ui_language_id" "uuid",
    "active" boolean DEFAULT true NOT NULL,
    "terms_accepted" boolean DEFAULT false NOT NULL,
    "terms_version" "text"
);


ALTER TABLE "public"."profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "source_language_id" "uuid" NOT NULL,
    "target_language_id" "uuid" NOT NULL,
    "active" boolean DEFAULT true
);


ALTER TABLE "public"."project" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_download" (
    "profile_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_download" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quest" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "description" "text",
    "project_id" "uuid" NOT NULL,
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."quest" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quest_asset_link" (
    "quest_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quest_asset_link" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quest_download" (
    "profile_id" "uuid" NOT NULL,
    "quest_id" "uuid" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quest_download" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quest_tag_link" (
    "quest_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quest_tag_link" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tag" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."tag" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."translation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "target_language_id" "uuid" NOT NULL,
    "text" "text",
    "audio" "text",
    "creator_id" "uuid",
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."translation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vote" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "translation_id" "uuid" NOT NULL,
    "polarity" "text" NOT NULL,
    "comment" "text",
    "creator_id" "uuid",
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."vote" OWNER TO "postgres";


ALTER TABLE ONLY "public"."asset_content_link"
    ADD CONSTRAINT "asset_content_link_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_download"
    ADD CONSTRAINT "asset_download_pkey" PRIMARY KEY ("profile_id", "asset_id");



ALTER TABLE ONLY "public"."asset_tag_link"
    ADD CONSTRAINT "asset_tags_pkey" PRIMARY KEY ("asset_id", "tag_id");



ALTER TABLE ONLY "public"."asset"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."language"
    ADD CONSTRAINT "languages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_download"
    ADD CONSTRAINT "project_download_pkey" PRIMARY KEY ("profile_id", "project_id");



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quest_asset_link"
    ADD CONSTRAINT "quest_asset_link_pkey" PRIMARY KEY ("quest_id", "asset_id");



ALTER TABLE ONLY "public"."quest_download"
    ADD CONSTRAINT "quest_download_pkey" PRIMARY KEY ("profile_id", "quest_id");



ALTER TABLE ONLY "public"."quest_tag_link"
    ADD CONSTRAINT "quest_tags_pkey" PRIMARY KEY ("quest_id", "tag_id");



ALTER TABLE ONLY "public"."quest"
    ADD CONSTRAINT "quests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tag"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."translation"
    ADD CONSTRAINT "translations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vote"
    ADD CONSTRAINT "votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_content_link"
    ADD CONSTRAINT "asset_content_link_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id");



ALTER TABLE ONLY "public"."asset_download"
    ADD CONSTRAINT "asset_download_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset_download"
    ADD CONSTRAINT "asset_download_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset_tag_link"
    ADD CONSTRAINT "asset_tags_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset_tag_link"
    ADD CONSTRAINT "asset_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset"
    ADD CONSTRAINT "assets_source_language_id_fkey" FOREIGN KEY ("source_language_id") REFERENCES "public"."language"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."language"
    ADD CONSTRAINT "languages_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_download"
    ADD CONSTRAINT "project_download_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_download"
    ADD CONSTRAINT "project_download_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "projects_source_language_id_fkey" FOREIGN KEY ("source_language_id") REFERENCES "public"."language"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "projects_target_language_id_fkey" FOREIGN KEY ("target_language_id") REFERENCES "public"."language"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quest_asset_link"
    ADD CONSTRAINT "quest_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quest_asset_link"
    ADD CONSTRAINT "quest_assets_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "public"."quest"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quest_download"
    ADD CONSTRAINT "quest_download_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quest_download"
    ADD CONSTRAINT "quest_download_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "public"."quest"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quest_tag_link"
    ADD CONSTRAINT "quest_tags_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "public"."quest"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quest_tag_link"
    ADD CONSTRAINT "quest_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quest"
    ADD CONSTRAINT "quests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."translation"
    ADD CONSTRAINT "translations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."translation"
    ADD CONSTRAINT "translations_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."translation"
    ADD CONSTRAINT "translations_target_language_id_fkey" FOREIGN KEY ("target_language_id") REFERENCES "public"."language"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "users_ui_language_id_fkey" FOREIGN KEY ("ui_language_id") REFERENCES "public"."language"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vote"
    ADD CONSTRAINT "votes_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vote"
    ADD CONSTRAINT "votes_translation_id_fkey" FOREIGN KEY ("translation_id") REFERENCES "public"."translation"("id") ON DELETE CASCADE;



CREATE POLICY "Enable ALL for users by id" ON "public"."asset" TO "authenticated", "anon" USING ((( SELECT "auth"."uid"() AS "uid") = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::"uuid", '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::"uuid", 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::"uuid", 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::"uuid", 'ff6e4bb4-3840-4168-917a-d29e09145958'::"uuid"])));



CREATE POLICY "Enable ALL for users by id" ON "public"."asset_content_link" TO "authenticated", "anon" USING ((( SELECT "auth"."uid"() AS "uid") = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::"uuid", '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::"uuid", 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::"uuid", 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::"uuid", 'ff6e4bb4-3840-4168-917a-d29e09145958'::"uuid"])));



CREATE POLICY "Enable ALL for users by id" ON "public"."asset_tag_link" TO "authenticated", "anon" USING ((( SELECT "auth"."uid"() AS "uid") = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::"uuid", '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::"uuid", 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::"uuid", 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::"uuid", 'ff6e4bb4-3840-4168-917a-d29e09145958'::"uuid"])));



CREATE POLICY "Enable ALL for users by id" ON "public"."project" USING ((( SELECT "auth"."uid"() AS "uid") = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::"uuid", '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::"uuid", 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::"uuid", 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::"uuid", 'ff6e4bb4-3840-4168-917a-d29e09145958'::"uuid"])));



CREATE POLICY "Enable ALL for users by id" ON "public"."quest" TO "authenticated", "anon" USING ((( SELECT "auth"."uid"() AS "uid") = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::"uuid", '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::"uuid", 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::"uuid", 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::"uuid", 'ff6e4bb4-3840-4168-917a-d29e09145958'::"uuid"])));



CREATE POLICY "Enable ALL for users by id" ON "public"."quest_asset_link" TO "authenticated", "anon" USING ((( SELECT "auth"."uid"() AS "uid") = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::"uuid", '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::"uuid", 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::"uuid", 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::"uuid", 'ff6e4bb4-3840-4168-917a-d29e09145958'::"uuid"])));



CREATE POLICY "Enable ALL for users by id" ON "public"."quest_tag_link" TO "authenticated", "anon" USING ((( SELECT "auth"."uid"() AS "uid") = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::"uuid", '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::"uuid", 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::"uuid", 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::"uuid", 'ff6e4bb4-3840-4168-917a-d29e09145958'::"uuid"])));



CREATE POLICY "Enable ALL for users by id" ON "public"."tag" TO "authenticated", "anon" USING ((( SELECT "auth"."uid"() AS "uid") = ANY (ARRAY['135167eb-7a93-4d90-8b00-85508facac71'::"uuid", '8f3a6249-9269-435d-9bf7-f60ae81ee27a'::"uuid", 'c111d43b-5983-4342-9d9e-5fc8d09d77b9'::"uuid", 'fd56eb4e-0b54-4715-863c-f865aee0b16d'::"uuid", 'ff6e4bb4-3840-4168-917a-d29e09145958'::"uuid"])));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."asset_download" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."project_download" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."quest_download" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."translation" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."vote" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."asset" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."asset_content_link" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."asset_tag_link" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."language" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."project" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."quest" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."quest_asset_link" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."quest_tag_link" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."tag" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."translation" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."vote" FOR SELECT USING (true);



CREATE POLICY "Enable read access for auth users" ON "public"."project_download" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable select for authenticated users only" ON "public"."asset_download" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "Enable select for authenticated users only" ON "public"."quest_download" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "Enable update for authenticated users only" ON "public"."asset_download" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "profile_id")) WITH CHECK (("auth"."uid"() = "profile_id"));



CREATE POLICY "Enable update for authenticated users only" ON "public"."project_download" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "profile_id")) WITH CHECK (("auth"."uid"() = "profile_id"));



CREATE POLICY "Enable update for authenticated users only" ON "public"."quest_download" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "profile_id")) WITH CHECK (("auth"."uid"() = "profile_id"));



CREATE POLICY "Enable update for authenticated users only" ON "public"."vote" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Users can read own profile" ON "public"."profile" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profile" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."asset" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asset_content_link" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asset_download" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asset_tag_link" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."language" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_download" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quest" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quest_asset_link" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quest_download" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quest_tag_link" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tag" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."translation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vote" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_user_conversion"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_conversion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_conversion"() TO "service_role";



GRANT ALL ON TABLE "public"."asset" TO "anon";
GRANT ALL ON TABLE "public"."asset" TO "authenticated";
GRANT ALL ON TABLE "public"."asset" TO "service_role";



GRANT ALL ON TABLE "public"."asset_content_link" TO "anon";
GRANT ALL ON TABLE "public"."asset_content_link" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_content_link" TO "service_role";



GRANT ALL ON TABLE "public"."asset_download" TO "anon";
GRANT ALL ON TABLE "public"."asset_download" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_download" TO "service_role";



GRANT ALL ON TABLE "public"."asset_tag_link" TO "anon";
GRANT ALL ON TABLE "public"."asset_tag_link" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_tag_link" TO "service_role";



GRANT ALL ON TABLE "public"."language" TO "anon";
GRANT ALL ON TABLE "public"."language" TO "authenticated";
GRANT ALL ON TABLE "public"."language" TO "service_role";



GRANT ALL ON TABLE "public"."profile" TO "anon";
GRANT ALL ON TABLE "public"."profile" TO "authenticated";
GRANT ALL ON TABLE "public"."profile" TO "service_role";



GRANT ALL ON TABLE "public"."project" TO "anon";
GRANT ALL ON TABLE "public"."project" TO "authenticated";
GRANT ALL ON TABLE "public"."project" TO "service_role";



GRANT ALL ON TABLE "public"."project_download" TO "anon";
GRANT ALL ON TABLE "public"."project_download" TO "authenticated";
GRANT ALL ON TABLE "public"."project_download" TO "service_role";



GRANT ALL ON TABLE "public"."quest" TO "anon";
GRANT ALL ON TABLE "public"."quest" TO "authenticated";
GRANT ALL ON TABLE "public"."quest" TO "service_role";



GRANT ALL ON TABLE "public"."quest_asset_link" TO "anon";
GRANT ALL ON TABLE "public"."quest_asset_link" TO "authenticated";
GRANT ALL ON TABLE "public"."quest_asset_link" TO "service_role";



GRANT ALL ON TABLE "public"."quest_download" TO "anon";
GRANT ALL ON TABLE "public"."quest_download" TO "authenticated";
GRANT ALL ON TABLE "public"."quest_download" TO "service_role";



GRANT ALL ON TABLE "public"."quest_tag_link" TO "anon";
GRANT ALL ON TABLE "public"."quest_tag_link" TO "authenticated";
GRANT ALL ON TABLE "public"."quest_tag_link" TO "service_role";



GRANT ALL ON TABLE "public"."tag" TO "anon";
GRANT ALL ON TABLE "public"."tag" TO "authenticated";
GRANT ALL ON TABLE "public"."tag" TO "service_role";



GRANT ALL ON TABLE "public"."translation" TO "anon";
GRANT ALL ON TABLE "public"."translation" TO "authenticated";
GRANT ALL ON TABLE "public"."translation" TO "service_role";



GRANT ALL ON TABLE "public"."vote" TO "anon";
GRANT ALL ON TABLE "public"."vote" TO "authenticated";
GRANT ALL ON TABLE "public"."vote" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";


CREATE publication powersync FOR TABLE public.asset, public.asset_content_link, public.asset_download, public.asset_tag_link, public.language, public.profile, public.project, public.project_download, public.quest, public.quest_asset_link, public.quest_download, public.quest_tag_link, public.tag, public.translation, public.vote;



RESET ALL;
