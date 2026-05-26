-- Invite bounce / delivery: in-app dismiss, per-project suppression, global per-email suppression.

-- Inviter can dismiss in-app delivery-failure notices without changing email outcome
alter table "public"."invite" add column "bounce_notice_dismissed_at" timestamp with time zone;

grant update (bounce_notice_dismissed_at) on table "public"."invite" to "service_role";

-- After repeated delivery failures, block further invite emails to this address for this project
alter table "public"."invite" add column "delivery_suppressed_at" timestamp with time zone;

grant update (delivery_suppressed_at) on table "public"."invite" to "service_role";

-- Global suppression for invite recipient addresses after repeated permanent bounces (see resend-webhook / send-email).
create table public.invite_email_suppression (
  normalized_email text primary key,
  permanent_bounce_count integer not null default 0,
  suppressed_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.invite_email_suppression is
  'Tracks permanent bounces per normalized email; threshold from INVITE_MAX_OUTBOUND_SENDS (edge env).';

alter table public.invite_email_suppression enable row level security;

create policy "Authenticated users can read invite email suppression"
  on public.invite_email_suppression
  for select
  to authenticated
  using (true);

grant select on table public.invite_email_suppression to authenticated;

grant select, insert, update on table public.invite_email_suppression to service_role;
