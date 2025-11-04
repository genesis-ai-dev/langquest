set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.link_profile_to_invite_requests()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.invite_request
  SET    receiver_profile_id = NEW.id,
         last_updated        = now()
  WHERE  email = NEW.email
    AND  receiver_profile_id IS NULL;

  RETURN NEW;
END;
$function$
;


