-- This migration is intentionally a no-op to force a Supabase redeploy.
-- It creates and immediately drops a dummy table.
create table if not exists dummy_do_not_use (id serial primary key);
drop table if exists dummy_do_not_use;