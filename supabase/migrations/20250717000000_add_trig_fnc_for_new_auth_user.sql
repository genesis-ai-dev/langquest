-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only create profile for confirmed email users who are not anonymous
  IF NEW.email_confirmed_at IS NOT NULL 
     AND (NEW.is_anonymous IS FALSE OR NEW.is_anonymous IS NULL)
  THEN
    INSERT INTO public.profile (
      id, 
      email,
      username,
      ui_language_id,
      terms_accepted,
      terms_accepted_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || SUBSTR(NEW.id::text, 1, 8)),
      CASE 
        WHEN uuid(NEW.raw_user_meta_data ->> 'ui_language_id') IS NOT NULL 
        THEN (NEW.raw_user_meta_data ->> 'ui_language_id')::uuid
        ELSE NULL
      END,
        (new.raw_user_meta_data ->> 'terms_accepted')::boolean,
        (new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signups (drop if exists first)
DROP TRIGGER IF EXISTS on_auth_user_signup ON auth.users;
CREATE TRIGGER on_auth_user_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user_signup();

-- Also update the existing conversion function to use the same logic for consistency
CREATE OR REPLACE FUNCTION handle_user_conversion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Handle anonymous user converting to permanent user
  IF NEW.is_anonymous = FALSE 
     AND NEW.email_confirmed_at IS NOT NULL 
     AND OLD.email_confirmed_at IS NULL 
  THEN
    INSERT INTO public.profile (
      id, 
      email,
      username,
      ui_language_id,
      terms_accepted,
      terms_accepted_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || SUBSTR(NEW.id::text, 1, 8)),
      CASE 
        WHEN uuid(NEW.raw_user_meta_data ->> 'ui_language_id') IS NOT NULL 
        THEN (NEW.raw_user_meta_data ->> 'ui_language_id')::uuid
        ELSE NULL
      END,
        (new.raw_user_meta_data ->> 'terms_accepted')::boolean,
        (new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;