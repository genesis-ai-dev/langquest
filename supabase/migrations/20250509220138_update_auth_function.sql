set check_function_bodies = off;

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
      username,
      ui_language_id,
      terms_accepted,
      terms_accepted_at
    )
    values (
      new.id,
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


