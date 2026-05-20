-- bounce_type: permanent | transient (Resend bounce.type)
-- bounce_reason: classified category (user_not_found, mailbox_full, rejected, general)

alter table public.invite
  add column bounce_type text;

comment on column public.invite.bounce_type is
  'Resend bounce severity: permanent (hard) or transient (soft).';
comment on column public.invite.bounce_reason is
  'Classified delivery failure for invite emails (set when email_status = bounced).';

-- Backfill before check constraints (legacy bounce_reason held provider text or permanent:category)
update public.invite
set
  bounce_type = case
    when bounce_reason ~* '^transient' then 'transient'
    else 'permanent'
  end,
  bounce_reason = 'user_not_found'
where email_status = 'bounced'
  and bounce_reason ~* '(^|:)user_not_found($|[^a-z])';

update public.invite
set
  bounce_type = coalesce(bounce_type, 'permanent'),
  bounce_reason = 'mailbox_full'
where email_status = 'bounced'
  and bounce_reason is not null
  and bounce_reason !~ '^(user_not_found|mailbox_full|rejected|general)$'
  and bounce_reason ~* '(^|:)mailbox_full($|[^a-z])';

update public.invite
set
  bounce_type = coalesce(bounce_type, 'permanent'),
  bounce_reason = 'rejected'
where email_status = 'bounced'
  and bounce_reason is not null
  and bounce_reason !~ '^(user_not_found|mailbox_full|rejected|general)$'
  and bounce_reason ~* '(^|:)rejected($|[^a-z])';

update public.invite
set
  bounce_type = coalesce(bounce_type, 'permanent'),
  bounce_reason = 'general'
where email_status = 'bounced'
  and bounce_reason is not null
  and bounce_reason !~ '^(user_not_found|mailbox_full|rejected|general)$';

alter table public.invite
  add constraint invite_bounce_type_check
  check (
    bounce_type is null
    or bounce_type = any (array['permanent'::text, 'transient'::text])
  );

alter table public.invite
  add constraint invite_bounce_reason_check
  check (
    bounce_reason is null
    or bounce_reason = any (
      array[
        'user_not_found'::text,
        'mailbox_full'::text,
        'rejected'::text,
        'general'::text
      ]
    )
  );

grant update (bounce_type)
  on table public.invite
  to service_role;

create or replace function public.get_schema_info()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'schema_version', '2.4',
    'min_required_schema_version', '2.1',
    'notes', 'Clients must be at least version 2.1 to sync. Invite: bounce_type (permanent|transient) + bounce_reason (classified).'
  );
$$;
