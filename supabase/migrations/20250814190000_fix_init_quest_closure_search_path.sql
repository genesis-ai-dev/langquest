-- migration: fix search_path for init_quest_closure to ensure quest_closure is visible

create or replace function public.init_quest_closure()
 returns trigger
 language plpgsql
 security definer
 set search_path = public
as $function$
begin
    raise notice '[init_quest_closure] Initializing quest_closure for quest_id: %, project_id: %', new.id, new.project_id;
    insert into public.quest_closure (quest_id, project_id)
    values (new.id, new.project_id);
    return new;
end;
$function$;


