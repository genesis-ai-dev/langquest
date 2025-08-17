-- migration: disable language refresh triggers during clone using app.clone_mode

create or replace function public.trigger_qal_refresh_languages_ins_upd()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return new;
  end if;
  declare pid uuid; begin
    perform public.update_quest_language_arrays(new.quest_id);
    select project_id into pid from public.quest where id = new.quest_id;
    if pid is not null then perform public.update_project_language_arrays(pid); end if;
    return new; end;
end; $$;

create or replace function public.trigger_qal_refresh_languages_del()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return old;
  end if;
  declare pid uuid; begin
    perform public.update_quest_language_arrays(old.quest_id);
    select project_id into pid from public.quest where id = old.quest_id;
    if pid is not null then perform public.update_project_language_arrays(pid); end if;
    return old; end;
end; $$;

create or replace function public.trigger_acl_refresh_languages_ins_upd()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return new;
  end if;
  perform public.refresh_languages_for_asset(new.asset_id);
  return new;
end; $$;

create or replace function public.trigger_acl_refresh_languages_del()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return old;
  end if;
  perform public.refresh_languages_for_asset(old.asset_id);
  return old;
end; $$;

create or replace function public.trigger_quest_refresh_languages_ins_upd()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return new;
  end if;
  perform public.update_quest_language_arrays(new.id);
  perform public.update_project_language_arrays(new.project_id);
  return new;
end; $$;

create or replace function public.trigger_pll_refresh_languages()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return coalesce(new, old);
  end if;
  perform public.update_project_language_arrays(coalesce(new.project_id, old.project_id));
  return coalesce(new, old);
end; $$;

create or replace function public.trigger_translation_refresh_languages_ins_upd()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return new;
  end if;
  perform public.refresh_languages_for_asset(new.asset_id);
  return new;
end; $$;

create or replace function public.trigger_translation_refresh_languages_del()
returns trigger
language plpgsql as $$
begin
  if current_setting('app.clone_mode', true) = 'on' then
    return old;
  end if;
  perform public.refresh_languages_for_asset(old.asset_id);
  return old;
end; $$


