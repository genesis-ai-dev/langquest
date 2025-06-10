create extension if not exists "http" with schema "public" version '1.6';

alter table "public"."invite_request" add column "as_owner" boolean not null default false;

alter table "public"."invite_request" add column "email" text not null;

alter table "public"."invite_request" add column "invite_count" integer not null;

alter table "public"."invite_request" alter column "receiver_profile_id" drop not null;

alter table "public"."profile" add column "email" text;

CREATE INDEX idx_invite_request_receiver_email ON public.invite_request USING btree (email) WHERE (receiver_profile_id IS NULL);

CREATE UNIQUE INDEX profile_email_key ON public.profile USING btree (email);

alter table "public"."profile" add constraint "profile_email_key" UNIQUE using index "profile_email_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_invite_request_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Only proceed if status changed to 'awaiting_trigger'
  IF NEW.status = 'awaiting_trigger' AND (OLD.status IS NULL OR OLD.status != 'awaiting_trigger') THEN
    -- Call the edge function
    PERFORM
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/send-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
        ),
        body := jsonb_build_object(
          'type', 'invite_request',
          'record', jsonb_build_object(
            'id', NEW.id,
            'sender_profile_id', NEW.sender_profile_id,
            'receiver_email', NEW.receiver_profile_id, -- Assuming this contains email for new users
            'project_id', NEW.project_id,
            'type', NEW.type,
            'status', NEW.status
          )
        )
      );
  END IF;
  
  RETURN NEW;
END;
$function$
;

-- Create types if they don't already exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'http_header') THEN
        CREATE TYPE "public"."http_header" AS ("field" character varying, "value" character varying);
    END IF;
END$$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'http_request') THEN
        CREATE TYPE "public"."http_request" AS ("method" http_method, "uri" character varying, "headers" http_header[], "content_type" character varying, "content" character varying);
    END IF;
END$$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'http_response') THEN
        CREATE TYPE "public"."http_response" AS ("status" integer, "content_type" character varying, "headers" http_header[], "content" character varying);
    END IF;
END$$;

CREATE OR REPLACE FUNCTION public.link_profile_to_invite_requests()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Update all invite_request records that have matching email and null receiver_profile_id
  UPDATE invite_request
  SET 
    receiver_profile_id = NEW.id,
    last_updated = CURRENT_TIMESTAMP
  WHERE 
    email = NEW.email 
    AND receiver_profile_id IS NULL;
  
  -- Log the update for debugging (optional - remove in production if not needed)
  IF FOUND THEN
    RAISE NOTICE 'Linked profile % to invite requests with email %', NEW.id, NEW.email;
  END IF;
  
  RETURN NEW;
END;
$function$
;

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
      email,
      username,
      ui_language_id,
      terms_accepted,
      terms_accepted_at
    )
    values (
      new.id,
      new.email,
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

CREATE TRIGGER on_invite_request_awaiting_trigger AFTER INSERT OR UPDATE ON public.invite_request FOR EACH ROW EXECUTE FUNCTION handle_invite_request_trigger();

CREATE TRIGGER on_profile_created_link_invites AFTER INSERT ON public.profile FOR EACH ROW WHEN ((new.email IS NOT NULL)) EXECUTE FUNCTION link_profile_to_invite_requests();


