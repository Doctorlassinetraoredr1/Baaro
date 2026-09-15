-- Schéma BAARO pour Supabase (idempotent).
-- Identité unique : profiles.id / wallets.id / crypto_holdings.id = auth.users.id
-- Peut être relancé sans erreur "policy already exists".

create table if not exists wallets (
  id uuid primary key references auth.users(id) on delete cascade,
  balance numeric not null default 0, updated_at timestamptz not null default now()
);
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  label text not null, pts numeric not null, action_key text, day_key date, reference_id uuid, created_at timestamptz not null default now()
);
create table if not exists crypto_holdings (
  id uuid primary key references auth.users(id) on delete cascade,
  holdings numeric not null default 0, updated_at timestamptz not null default now()
);
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Nouveau membre', flag text default '🌍', handle text, created_at timestamptz not null default now()
);
create table if not exists posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id) on delete cascade,
  text text not null, created_at timestamptz not null default now()
);
create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (post_id, user_id)
);
create table if not exists videos (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id) on delete cascade,
  title text not null, duration text, views int not null default 0, created_at timestamptz not null default now()
);
create table if not exists follows (
  follower_id uuid not null references auth.users(id) on delete cascade, followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (follower_id, followed_id)
);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null,
  sender_id uuid not null references auth.users(id) on delete cascade, recipient_id uuid not null references auth.users(id) on delete cascade,
  text text not null, created_at timestamptz not null default now()
);
create table if not exists votes (
  proposal_id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  choice text not null, created_at timestamptz not null default now(), primary key (proposal_id, user_id)
);

alter table wallets enable row level security;
alter table transactions enable row level security;
alter table crypto_holdings enable row level security;
alter table profiles enable row level security;
alter table posts enable row level security;
alter table post_likes enable row level security;
alter table videos enable row level security;
alter table follows enable row level security;
alter table messages enable row level security;
alter table votes enable row level security;

-- Drop avant create (évite ERROR 42710 policy already exists)
DROP POLICY IF EXISTS "wallet_own" ON wallets;
DROP POLICY IF EXISTS "tx_own" ON transactions;
DROP POLICY IF EXISTS "crypto_own" ON crypto_holdings;
DROP POLICY IF EXISTS "profiles_read" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "posts_read" ON posts;
DROP POLICY IF EXISTS "posts_insert" ON posts;
DROP POLICY IF EXISTS "likes_read" ON post_likes;
DROP POLICY IF EXISTS "likes_own" ON post_likes;
DROP POLICY IF EXISTS "videos_read" ON videos;
DROP POLICY IF EXISTS "videos_insert" ON videos;
DROP POLICY IF EXISTS "follows_read" ON follows;
DROP POLICY IF EXISTS "follows_own" ON follows;
DROP POLICY IF EXISTS "votes_read" ON votes;
DROP POLICY IF EXISTS "votes_own" ON votes;
DROP POLICY IF EXISTS "messages_read" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;

CREATE POLICY "wallet_own" ON wallets FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "tx_own" ON transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "crypto_own" ON crypto_holdings FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "posts_read" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "likes_read" ON post_likes FOR SELECT USING (true);
CREATE POLICY "likes_own" ON post_likes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "videos_read" ON videos FOR SELECT USING (true);
CREATE POLICY "videos_insert" ON videos FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "follows_read" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_own" ON follows FOR ALL USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "votes_read" ON votes FOR SELECT USING (true);
CREATE POLICY "votes_own" ON votes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "messages_read" ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
