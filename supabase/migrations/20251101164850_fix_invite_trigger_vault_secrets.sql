-- Fix handle_invite_trigger to handle missing vault secrets gracefully
-- Instead of using STRICT which raises P0002 when secrets don't exist,
-- we'll use regular SELECT INTO and check if secrets exist before using them

CREATE OR REPLACE FUNCTION public.handle_invite_trigger()
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
  -- Use regular SELECT INTO (not STRICT) to avoid P0002 error if secrets don't exist
  select decrypted_secret
    into _base_url
    from vault.decrypted_secrets
   where name = 'supabase_url'
   limit 1;

  select decrypted_secret
    into _sr_key
    from vault.decrypted_secrets
   where name = 'supabase_service_role_key'
   limit 1;

  /* ── 2. fire the Edge Function only when status → pending ── */
  -- Only proceed if we have both secrets and the status is pending
  if NEW.status = 'pending'
     and (OLD.status is null or OLD.status <> 'pending')
     and _base_url is not null
     and _sr_key is not null then

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
end;
$function$
;

