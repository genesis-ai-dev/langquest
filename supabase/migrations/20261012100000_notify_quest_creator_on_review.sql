-- Path A: notify the quest creator when a review of their quest is submitted.
-- Internal reviews arrive already submitted (INSERT through PowerSync); external
-- reviews move from in_progress to submitted (UPDATE by submit_quest_review).
-- The notification row syncs to the creator through the existing notification bucket.
-- No APP_SCHEMA_VERSION / get_schema_info() bump: notification already exists on the client.

create or replace function public.notify_quest_creator_on_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_id uuid;
begin
  if new.status is distinct from 'submitted' or not new.active then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is not distinct from 'submitted' then
    return new;
  end if;

  select q.creator_id
    into v_creator_id
    from public.quest q
   where q.id = new.quest_id;

  if v_creator_id is null then
    return new;
  end if;

  -- The creator does not need to hear about their own internal review.
  if new.profile_id is not distinct from v_creator_id
     and new.origin is distinct from 'External' then
    return new;
  end if;

  insert into public.notification (
    profile_id,
    target_table_name,
    target_record_id
  )
  select v_creator_id, 'review', new.id
   where not exists (
     select 1
       from public.notification n
      where n.profile_id = v_creator_id
        and n.target_table_name = 'review'
        and n.target_record_id = new.id
   );

  return new;
end;
$$;

revoke all on function public.notify_quest_creator_on_review() from public;
revoke all on function public.notify_quest_creator_on_review() from anon, authenticated;

drop trigger if exists trigger_notify_quest_creator_on_review on public.review;
create trigger trigger_notify_quest_creator_on_review
  after insert or update of status on public.review
  for each row
  execute function public.notify_quest_creator_on_review();

comment on function public.notify_quest_creator_on_review() is
  'Inserts one notification (target_table_name = review) for quest.creator_id when a review of the quest becomes submitted. Skips inactive reviews and the creator''s own internal reviews.';
