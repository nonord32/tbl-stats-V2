-- TBL Stats Pick'em — Supabase Schema
-- Copy-paste this into the Supabase SQL editor and run it.

-- ─── Profiles table ───────────────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- ─── Picks table ──────────────────────────────────────────────────────────────
create table public.picks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  match_index integer not null,
  picked_team text not null,
  diff_band text not null check (diff_band in ('close', 'medium', 'comfortable', 'dominant')),
  is_correct_winner boolean,
  is_correct_band boolean,
  points_earned integer default 0 not null,
  resolved_at timestamptz,
  created_at timestamptz default now() not null,
  unique(user_id, match_index)
);

alter table public.picks enable row level security;

create policy "Users can view own picks"
  on public.picks for select using (auth.uid() = user_id);

create policy "Users can insert own picks"
  on public.picks for insert with check (auth.uid() = user_id);

create policy "Users can update own unresolved picks"
  on public.picks for update using (auth.uid() = user_id and resolved_at is null);

-- Note: the service role key bypasses RLS automatically, so no extra policy
-- is needed for the /api/resolve admin route.

-- ─── Leaderboard view ─────────────────────────────────────────────────────────
create or replace view public.leaderboard as
select
  p.user_id,
  pr.username,
  pr.display_name,
  count(*) filter (where p.resolved_at is not null)::integer as total_picks,
  coalesce(sum(p.points_earned) filter (where p.resolved_at is not null), 0)::integer as total_points,
  count(*) filter (where p.is_correct_winner = true)::integer as correct_winners,
  count(*) filter (where p.is_correct_winner = true and p.is_correct_band = true)::integer as exact_picks,
  round(
    count(*) filter (where p.is_correct_winner = true)::numeric /
    nullif(count(*) filter (where p.resolved_at is not null), 0) * 100, 1
  ) as win_pct
from public.picks p
join public.profiles pr on p.user_id = pr.id
group by p.user_id, pr.username, pr.display_name
order by total_points desc, exact_picks desc;
