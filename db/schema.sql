-- Run once in Supabase: SQL Editor, New query, paste, Run.
create table if not exists public.jelarp_state (
  id int primary key default 1 check (id = 1),
  version int not null default 0,
  doc jsonb not null default '{}'::jsonb
);

alter table public.jelarp_state enable row level security;

insert into public.jelarp_state (id) values (1) on conflict (id) do nothing;
