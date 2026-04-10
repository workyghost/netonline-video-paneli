-- NetOnline Digital Signage — Supabase Migration (v2.9.1 uyumlu)
-- Bu dosya Supabase SQL Editor'e yapıştırılarak çalıştırılır.
-- Idempotent: tekrar çalıştırılabilir.

-- ── TABLOLAR ──

CREATE TABLE IF NOT EXISTS firms (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS videos (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title         text NOT NULL,
  firm_id       uuid REFERENCES firms(id) ON DELETE SET NULL,
  orientation   text DEFAULT 'horizontal',
  file_name     text,
  file_url      text,
  thumbnail_url text,
  is_active     boolean DEFAULT true,
  starts_at     timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS screens (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  firm_id             uuid REFERENCES firms(id) ON DELETE SET NULL,
  name                text NOT NULL,
  location            text,
  orientation         text DEFAULT 'horizontal',
  status              text DEFAULT 'offline',
  last_seen           timestamptz,
  current_video_id    uuid,
  current_video_title text,
  playlist_id         uuid,
  registered_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS playlists (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  firm_id    uuid REFERENCES firms(id) ON DELETE SET NULL,
  name       text NOT NULL,
  items      jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- screens → playlists FK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'screens_playlist_id_fkey'
  ) THEN
    ALTER TABLE screens ADD CONSTRAINT screens_playlist_id_fkey
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS play_logs (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  screen_id        uuid REFERENCES screens(id) ON DELETE CASCADE,
  video_id         uuid REFERENCES videos(id) ON DELETE SET NULL,
  video_title      text,
  firm_id          uuid REFERENCES firms(id) ON DELETE SET NULL,
  started_at       timestamptz DEFAULT now(),
  ended_at         timestamptz,
  duration_seconds integer
);

-- ── EKSİK KOLON MİGRASYONLARI ──
ALTER TABLE videos ADD COLUMN IF NOT EXISTS starts_at timestamptz;

-- ── İNDEKSLER ──
CREATE INDEX IF NOT EXISTS idx_videos_firm_id      ON videos(firm_id);
CREATE INDEX IF NOT EXISTS idx_videos_is_active    ON videos(is_active);
CREATE INDEX IF NOT EXISTS idx_screens_firm_id     ON screens(firm_id);
CREATE INDEX IF NOT EXISTS idx_screens_playlist_id ON screens(playlist_id);
CREATE INDEX IF NOT EXISTS idx_play_logs_screen_id ON play_logs(screen_id);
CREATE INDEX IF NOT EXISTS idx_play_logs_started   ON play_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_play_logs_firm_id   ON play_logs(firm_id);

-- ── RLS ──
ALTER TABLE firms      ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE screens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists  ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_logs  ENABLE ROW LEVEL SECURITY;

-- firms
DROP POLICY IF EXISTS "firms_auth_select" ON firms;
CREATE POLICY "firms_auth_select" ON firms FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "firms_auth_insert" ON firms;
CREATE POLICY "firms_auth_insert" ON firms FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "firms_auth_update" ON firms;
CREATE POLICY "firms_auth_update" ON firms FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "firms_auth_delete" ON firms;
CREATE POLICY "firms_auth_delete" ON firms FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "firms_anon_select" ON firms;
CREATE POLICY "firms_anon_select" ON firms FOR SELECT TO anon USING (true);

-- videos
DROP POLICY IF EXISTS "videos_auth_select" ON videos;
CREATE POLICY "videos_auth_select" ON videos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "videos_auth_insert" ON videos;
CREATE POLICY "videos_auth_insert" ON videos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "videos_auth_update" ON videos;
CREATE POLICY "videos_auth_update" ON videos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "videos_auth_delete" ON videos;
CREATE POLICY "videos_auth_delete" ON videos FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "videos_anon_select" ON videos;
CREATE POLICY "videos_anon_select" ON videos FOR SELECT TO anon USING (true);

-- screens
DROP POLICY IF EXISTS "screens_auth_select" ON screens;
CREATE POLICY "screens_auth_select" ON screens FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "screens_auth_insert" ON screens;
CREATE POLICY "screens_auth_insert" ON screens FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "screens_auth_update" ON screens;
CREATE POLICY "screens_auth_update" ON screens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "screens_auth_delete" ON screens;
CREATE POLICY "screens_auth_delete" ON screens FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "screens_anon_select" ON screens;
CREATE POLICY "screens_anon_select" ON screens FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "screens_anon_insert" ON screens;
CREATE POLICY "screens_anon_insert" ON screens FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "screens_anon_update" ON screens;
CREATE POLICY "screens_anon_update" ON screens FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- playlists
DROP POLICY IF EXISTS "playlists_auth_select" ON playlists;
CREATE POLICY "playlists_auth_select" ON playlists FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "playlists_auth_insert" ON playlists;
CREATE POLICY "playlists_auth_insert" ON playlists FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "playlists_auth_update" ON playlists;
CREATE POLICY "playlists_auth_update" ON playlists FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "playlists_auth_delete" ON playlists;
CREATE POLICY "playlists_auth_delete" ON playlists FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "playlists_anon_select" ON playlists;
CREATE POLICY "playlists_anon_select" ON playlists FOR SELECT TO anon USING (true);

-- play_logs
DROP POLICY IF EXISTS "play_logs_auth_select" ON play_logs;
CREATE POLICY "play_logs_auth_select" ON play_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "play_logs_anon_insert" ON play_logs;
CREATE POLICY "play_logs_anon_insert" ON play_logs FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "play_logs_anon_update" ON play_logs;
CREATE POLICY "play_logs_anon_update" ON play_logs FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "play_logs_anon_select" ON play_logs;
CREATE POLICY "play_logs_anon_select" ON play_logs FOR SELECT TO anon USING (true);

-- ── REALTIME ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE firms;
ALTER PUBLICATION supabase_realtime ADD TABLE videos;
ALTER PUBLICATION supabase_realtime ADD TABLE screens;
ALTER PUBLICATION supabase_realtime ADD TABLE playlists;
