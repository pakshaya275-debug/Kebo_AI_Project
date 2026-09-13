create table if not exists public.kebo_memories (
  id text primary key,
  device_id text not null,
  text text not null,
  type text not null default 'user_fact' check (type in ('user_fact', 'preference', 'goal', 'emotion', 'event')),
  importance real not null default 0.8 check (importance >= 0 and importance <= 1),
  confidence real not null default 0.8 check (confidence >= 0 and confidence <= 1),
  source text not null default 'user_message' check (source in ('user_message', 'reasoning_plan')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create index if not exists kebo_memories_device_id_idx
  on public.kebo_memories (device_id, created_at desc);

alter table public.kebo_memories add column if not exists type text not null default 'user_fact';
alter table public.kebo_memories add column if not exists confidence real not null default 0.8;
alter table public.kebo_memories add column if not exists source text not null default 'user_message';

alter table public.kebo_memories enable row level security;

create policy "Kebo demo memories are readable by device id"
  on public.kebo_memories for select
  using (true);

create policy "Kebo demo memories are insertable"
  on public.kebo_memories for insert
  with check (true);

create policy "Kebo demo memories are updatable"
  on public.kebo_memories for update
  using (true)
  with check (true);

create policy "Kebo demo memories are deletable"
  on public.kebo_memories for delete
  using (true);
