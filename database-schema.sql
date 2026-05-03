-- ============================================================
-- STOKMATE DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- Project: https://eyeidefdslfqurrwowgh.supabase.co
-- ============================================================

-- PROFILES
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  phone text,
  referral_code text unique,
  referral_earnings integer default 0,
  plan text default 'free',
  created_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;

create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- GROUPS
create table if not exists groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  group_type text default 'rotating',
  type_icon text default '🔄',
  contribution_amount decimal default 0,
  currency text default 'R',
  invite_code text unique,
  created_by uuid references auth.users,
  members_count integer default 0,
  paid_count integer default 0,
  payout_order text default 'rotating',
  cycle text default 'monthly',
  health_score integer default 100,
  current_payout_turn integer default 1,
  current_month_year text default to_char(now(), 'Mon YYYY'),
  is_pro boolean default false,
  created_at timestamptz default now()
);

alter table groups enable row level security;

drop policy if exists "Group members can view groups" on groups;
drop policy if exists "Authenticated users can create groups" on groups;
drop policy if exists "Group admins can update groups" on groups;
drop policy if exists "Anyone can view group by invite code" on groups;

create policy "Group members can view groups" on groups for select using (
  exists (select 1 from group_members where group_id = groups.id and user_id = auth.uid())
);
create policy "Anyone can view group by invite code" on groups for select using (
  invite_code is not null
);
create policy "Authenticated users can create groups" on groups for insert with check (auth.uid() = created_by);
create policy "Group admins can update groups" on groups for update using (
  exists (select 1 from group_members where group_id = groups.id and user_id = auth.uid() and role = 'admin')
);

-- GROUP MEMBERS
create table if not exists group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text default 'member',
  paid_this_month boolean default false,
  reliability_score integer default 100,
  months_paid integer default 0,
  months_total integer default 0,
  payout_turn integer,
  display_name text,
  phone text,
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

alter table group_members enable row level security;

drop policy if exists "Members can view group members" on group_members;
drop policy if exists "Users can join groups" on group_members;
drop policy if exists "Members can update own record" on group_members;
drop policy if exists "Admins can update any member" on group_members;

create policy "Members can view group members" on group_members for select using (
  exists (select 1 from group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid())
);
create policy "Users can join groups" on group_members for insert with check (auth.uid() = user_id);
create policy "Members can update own record" on group_members for update using (auth.uid() = user_id);
create policy "Admins can update any member" on group_members for update using (
  exists (select 1 from group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
);

-- PAYMENTS
create table if not exists payments (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups on delete cascade,
  user_id uuid references auth.users,
  amount decimal not null,
  currency text default 'R',
  month_year text,
  confirmed_by uuid references auth.users,
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

alter table payments enable row level security;

drop policy if exists "Group members can view payments" on payments;
drop policy if exists "Members can log payments" on payments;
drop policy if exists "Admins can insert payments" on payments;

create policy "Group members can view payments" on payments for select using (
  exists (select 1 from group_members where group_id = payments.group_id and user_id = auth.uid())
);
create policy "Members can log payments" on payments for insert with check (
  exists (select 1 from group_members where group_id = payments.group_id and user_id = auth.uid())
);

-- VAULT ENTRIES (tamper-proof activity log)
create table if not exists vault_entries (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups on delete cascade,
  action text not null,
  performed_by uuid references auth.users,
  target_user_id uuid references auth.users,
  details jsonb default '{}',
  created_at timestamptz default now()
);

alter table vault_entries enable row level security;

drop policy if exists "Group members can view vault" on vault_entries;
drop policy if exists "System can insert vault entries" on vault_entries;

create policy "Group members can view vault" on vault_entries for select using (
  exists (select 1 from group_members where group_id = vault_entries.group_id and user_id = auth.uid())
);
create policy "Members can insert vault entries" on vault_entries for insert with check (
  exists (select 1 from group_members where group_id = vault_entries.group_id and user_id = auth.uid())
);

-- SUBSCRIPTIONS
create table if not exists subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users,
  group_id uuid references groups on delete cascade unique,
  payfast_payment_id text,
  amount decimal,
  status text default 'trial',
  activated_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz default now()
);

alter table subscriptions enable row level security;

drop policy if exists "Users can view own subscriptions" on subscriptions;

create policy "Users can view own subscriptions" on subscriptions for select using (auth.uid() = user_id);

-- FUNCTION: auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, phone, referral_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'phone',
    upper(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), '\s+', '', 'g')) || floor(random() * 9000 + 1000)::text
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
