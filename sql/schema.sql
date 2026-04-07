-- sql/schema.sql
-- Drop existing tables and policies if re-applying
drop table if exists playlists cascade;
drop table if exists screens cascade;
drop table if exists videos cascade;
drop table if exists firms cascade;

-- ==========================================
-- 1. TABLES
-- ==========================================

-- Firms Table
create table firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Videos Table
create table videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  firm_id uuid references firms(id) on delete cascade not null,
  orientation text check (orientation in ('horizontal', 'vertical', 'both')) not null,
  file_name text not null,
  file_url text not null,
  thumbnail_url text,
  is_active boolean default true not null,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Screens Table
create table screens (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade not null,
  name text not null,
  location text not null,
  orientation text check (orientation in ('horizontal', 'vertical')) not null,
  status text check (status in ('online', 'offline')) default 'offline' not null,
  last_seen timestamp with time zone,
  current_video_id uuid references videos(id) on delete set null,
  current_video_title text,
  playlist_id uuid, -- Will reference playlists later after table creation
  registered_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Playlists Table
create table playlists (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id) on delete cascade not null,
  name text not null,
  items jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add Reference to screens for playlists
alter table screens
add constraint fk_playlist_id
foreign key (playlist_id) references playlists(id) on delete set null;


-- ==========================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
alter table firms enable row level security;
alter table videos enable row level security;
alter table screens enable row level security;
alter table playlists enable row level security;

-- Admin Policy (Authenticated users can do everything)
-- We assume Admin users login via Email/Password (Supabase Auth)
create policy "Admins have full access to firms" on firms for all using (auth.role() = 'authenticated');
create policy "Admins have full access to videos" on videos for all using (auth.role() = 'authenticated');
create policy "Admins have full access to screens" on screens for all using (auth.role() = 'authenticated');
create policy "Admins have full access to playlists" on playlists for all using (auth.role() = 'authenticated');


-- Public / Player Policies
-- PLayers use Anonymous Logins (Or just public read for content)
-- Players only need to READ firms, videos, playlists to work.
create policy "Players can view firms" on firms for select using (true);
create policy "Players can view active videos" on videos for select using (is_active = true);
create policy "Players can view playlists" on playlists for select using (true);

-- Players need to READ screens, CREATE screens (on setup) and UPDATE heartbeat
create policy "Players can read screens" on screens for select using (true);
create policy "Players can insert screens" on screens for insert with check (true);
create policy "Players can update their own screen metrics" on screens for update
  using (true)
  with check (true); 

-- SECURITY TRIGGER: Prevent anonymous users from hijacking screens
-- They are only allowed to update heartbeat columns.
create or replace function restrict_screen_updates()
returns trigger as $$
begin
  if auth.role() != 'authenticated' then
    if new.firm_id is distinct from old.firm_id or
       new.name is distinct from old.name or
       new.location is distinct from old.location or
       new.orientation is distinct from old.orientation or
       new.playlist_id is distinct from old.playlist_id then
      raise exception 'Anonymous users can only update heartbeat columns.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists restrict_screen_update_trigger on screens;
create trigger restrict_screen_update_trigger
  before update on screens
  for each row
  execute function restrict_screen_updates();


-- ==========================================
-- 3. STORAGE & REALTIME SETUP
-- ==========================================
-- NOTE: Please execute these in the Supabase UI or SQL Editor.

-- We need to turn on replication for these tables for realtime subscriptions.
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table firms, videos, screens, playlists;

-- Ensure you create a bucket named 'digital-signage' 
-- Enable Public access, and Add storage rules if necessary on the Supabase Dashboard.
-- Ya da aşağıdaki SQL komutlarını çalıştırarak bucket ve RLS kurallarını oluşturabilirsiniz:

insert into storage.buckets (id, name, public) 
values ('digital-signage', 'digital-signage', true)
on conflict (id) do nothing;

create policy "Public read access for digital-signage bucket"
on storage.objects for select
using ( bucket_id = 'digital-signage' );

create policy "Authenticated users can upload to digital-signage bucket"
on storage.objects for insert
with check ( bucket_id = 'digital-signage' and auth.role() = 'authenticated' );

create policy "Authenticated users can update digital-signage bucket"
on storage.objects for update
using ( bucket_id = 'digital-signage' and auth.role() = 'authenticated' );

create policy "Authenticated users can delete from digital-signage bucket"
on storage.objects for delete
using ( bucket_id = 'digital-signage' and auth.role() = 'authenticated' );
