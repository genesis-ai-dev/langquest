set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_invite_request_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare
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
  if NEW.status = 'awaiting_trigger'
     and (OLD.status is null or OLD.status <> 'awaiting_trigger') then

    perform net.http_post(
      url      := _base_url || '/functions/v1/send-email',
      headers  := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || _sr_key),
      body     := jsonb_build_object(
                    'type',   'invite_request',
                    'record', jsonb_build_object(
                                'id',               NEW.id,
                                'sender_profile_id',NEW.sender_profile_id,
                                'receiver_email',   NEW.email,
                                'project_id',       NEW.project_id,
                                'type',             NEW.type,
                                'status',           NEW.status))
    );
  end if;

  return NEW;
end;
$function$
;


