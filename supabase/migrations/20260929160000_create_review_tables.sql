-- Path A: review tables exist on the server only for now.
-- The client keeps matching local-only tables and does not sync these yet.
-- No APP_SCHEMA_VERSION / get_schema_info() bump.

create table public.review (
    id uuid primary key default gen_random_uuid(),

    project_id uuid not null
        references public.project(id),

    quest_id uuid not null
        references public.quest(id),

    profile_id uuid null
        references public.profile(id),

    status text not null default 'in_progress',

    access_token text null,

    active boolean not null default true,

    origin text not null,

    external_id text null,

    quest_result text null,

    conclusion text null,

    metadata text not null default '{}',

    created_at timestamptz not null default now(),

    concluded_at timestamptz null
);

create table public.review_asset (
    review_id uuid not null
        references public.review(id)
        on delete cascade,

    asset_id uuid not null,

    asset_result text null,

    comment text null,

    audio text[] null,

    metadata text not null default '{}',

    primary key (review_id, asset_id)
);

create index review_project_id_idx on public.review (project_id);
create index review_quest_id_idx on public.review (quest_id);
create index review_profile_id_idx on public.review (profile_id);
create unique index review_access_token_idx
    on public.review (access_token)
    where access_token is not null;

comment on table public.review is
    'Quest review. status stays in_progress until the review is concluded.';
comment on column public.review.access_token is
    'Opaque token for an external reviewer. Null when the review is not shared.';
comment on column public.review.origin is
    'Display origin of the review, such as a book or chapter name.';
comment on column public.review.quest_result is
    'Outcome for the quest as a whole, set when the review is concluded.';
comment on table public.review_asset is
    'Per-asset notes, result, and audio attached to a review.';

alter table public.review enable row level security;
alter table public.review_asset enable row level security;

create policy review_authenticated_all
  on public.review
  for all
  to authenticated
  using (true)
  with check (true);

create policy review_asset_authenticated_all
  on public.review_asset
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.review to authenticated;
grant select, insert, update, delete on public.review_asset to authenticated;
