-- JARVIS: run this whole file once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 12000),
  created_at timestamptz not null default now()
);

create table if not exists public.pc_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  command_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','completed','error')),
  response text,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists pc_commands_device_idx on public.pc_commands(device_id,status,created_at);
create index if not exists pc_commands_user_idx on public.pc_commands(user_id,created_at desc);
create index if not exists chat_messages_user_idx on public.chat_messages(user_id,created_at);

alter table public.chat_messages enable row level security;
alter table public.pc_commands enable row level security;

drop policy if exists "chat_select_own" on public.chat_messages;
drop policy if exists "chat_insert_own" on public.chat_messages;
drop policy if exists "commands_select_own" on public.pc_commands;
drop policy if exists "commands_insert_own" on public.pc_commands;

create policy "chat_select_own"
on public.chat_messages for select
to authenticated
using (user_id = auth.uid());

create policy "chat_insert_own"
on public.chat_messages for insert
to authenticated
with check (user_id = auth.uid());

create policy "commands_select_own"
on public.pc_commands for select
to authenticated
using (user_id = auth.uid());

create policy "commands_insert_own"
on public.pc_commands for insert
to authenticated
with check (user_id = auth.uid());

grant select, insert on public.chat_messages to authenticated;
grant select, insert on public.pc_commands to authenticated;
grant all on public.chat_messages to service_role;
grant all on public.pc_commands to service_role;

-- Realtime is not required for correctness (the UI also polls), but enables instant updates when available.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pc_commands') then
    alter publication supabase_realtime add table public.pc_commands;
  end if;
end $$;

alter table public.pc_commands replica identity full;
