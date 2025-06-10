set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.set_receiver_profile_on_invite_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Only link if the caller didn’t already supply a receiver_profile_id
  IF NEW.receiver_profile_id IS NULL THEN
    SELECT id
    INTO   v_profile_id
    FROM   public.profile
    WHERE  email = NEW.email
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
      NEW.receiver_profile_id := v_profile_id;  -- link the profile
      NEW.last_updated        := now();         -- keep timestamp accurate
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE TRIGGER before_invite_request_set_receiver BEFORE INSERT ON public.invite_request FOR EACH ROW EXECUTE FUNCTION set_receiver_profile_on_invite_request();


