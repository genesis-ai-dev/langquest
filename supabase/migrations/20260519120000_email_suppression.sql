-- Global email deliverability suppression (replaces invite_email_suppression).

create type public.email_suppression_reason as enum (
  'hard_bounce',
  'complaint',
  'soft_bounce',
  'manual'
);

create table public.email_suppression (
  normalized_email text primary key,
  reason public.email_suppression_reason not null,
  soft_bounce_count integer not null default 0,
  suppressed_at timestamptz,
  soft_suppressed_at timestamptz,
  expires_at timestamptz,
  deactivated_at timestamptz,
  source_resend_email_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.email_suppression is
  'Global deliverability suppression per normalized recipient. Hard/complaint: suppressed_at. Soft at threshold: soft_suppressed_at + expires_at (60d, lazy deactivate).';

comment on column public.email_suppression.suppressed_at is
  'Set immediately for hard_bounce and complaint.';
comment on column public.email_suppression.soft_suppressed_at is
  'Set when soft_bounce_count reaches EMAIL_SOFT_BOUNCE_THRESHOLD.';
comment on column public.email_suppression.deactivated_at is
  'Set when soft-tier suppression expires; row is inactive for blocking.';

alter table public.email_suppression enable row level security;

create policy "Invite senders and project owners can read email suppression"
  on public.email_suppression
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.invite i
      where lower(trim(i.email)) = email_suppression.normalized_email
        and (
          i.sender_profile_id = auth.uid()
          or exists (
            select 1
            from public.profile_project_link ppl
            where ppl.project_id = i.project_id
              and ppl.profile_id = auth.uid()
              and ppl.active = true
              and ppl.membership = 'owner'
          )
        )
    )
  );

grant select on table public.email_suppression to authenticated;
grant select, insert, update on table public.email_suppression to service_role;

drop table if exists public.invite_email_suppression;

alter table public.invite drop column if exists delivery_suppressed_at;
