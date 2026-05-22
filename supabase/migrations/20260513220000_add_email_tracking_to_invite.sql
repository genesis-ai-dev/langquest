-- Add email tracking columns to invite table for bounce/delivery status
alter table "public"."invite" add column "resend_email_id" text;
alter table "public"."invite" add column "email_status" text default 'sent';
alter table "public"."invite" add column "email_sent_at" timestamp with time zone;
alter table "public"."invite" add column "email_delivered_at" timestamp with time zone;
alter table "public"."invite" add column "email_bounced_at" timestamp with time zone;
alter table "public"."invite" add column "bounce_reason" text;

-- Add constraint for email_status values
alter table "public"."invite" add constraint "invite_email_status_check" 
  check (("email_status" = any (array['sent'::text, 'delivered'::text, 'bounced'::text, 'complained'::text])));

-- Create index for looking up invites by resend_email_id (for webhook processing)
create index idx_invite_resend_email_id on public.invite using btree (resend_email_id) 
  where (resend_email_id is not null);

-- Grant access to new columns (following existing pattern)
grant update (resend_email_id, email_status, email_sent_at, email_delivered_at, email_bounced_at, bounce_reason) 
  on table "public"."invite" to "service_role";
