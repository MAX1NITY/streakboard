-- Streakboard schema. Run once in Supabase: SQL Editor -> paste -> Run.
-- Every table is locked to the signed-in user with Row Level Security.

create table if not exists public.goals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('deadline','numeric')),
  target_value numeric,
  unit text,
  start_date date not null,
  end_date date,
  color text not null default '#5eeaaa',
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  title text not null,
  type text not null check (type in ('recurring','oneoff')),
  days_of_week int[] not null default '{0,1,2,3,4,5,6}',
  weekly_target int check (weekly_target between 1 and 7),
  start_date date not null,
  end_date date,
  amount numeric not null default 1,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.completions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  date date not null,
  value numeric not null default 1,
  created_at timestamptz not null default now(),
  unique (task_id, date)
);

-- for projects created from an earlier version of this file
alter table public.tasks add column if not exists weekly_target int check (weekly_target between 1 and 7);

create index if not exists tasks_user_idx on public.tasks(user_id);
create index if not exists completions_user_date_idx on public.completions(user_id, date);

alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.completions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['goals','tasks','completions'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t);
  end loop;
end $$;
